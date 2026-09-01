/* OP_RETURN carrier decoder.
   Runs entirely in the page. Nothing you paste is logged, stored or sent
   anywhere. The rules below mirror the parsers in the Bitcoin Universe
   OP-20 / OP Names authority and the OP Inscriptions indexer.

   Document version: 1.0.0   Chain: bitcoin   Network: mainnet rules */
(function () {
  'use strict';

  var MAX_CARRIER_BYTES = 4096;
  var LEGACY_RELAY_SCRIPT_BYTES = 83;

  /* ---------- byte helpers ---------- */

  function hexToBytes(text) {
    var clean = text.replace(/^0x/i, '').replace(/[\s:,]/g, '');
    if (clean.length === 0) throw new Error('Enter a scriptPubKey hex string.');
    if (!/^[0-9a-fA-F]+$/.test(clean)) throw new Error('The input contains characters that are not hexadecimal.');
    if (clean.length % 2 !== 0) throw new Error('Hex length is odd, so the script is not a whole number of bytes.');
    var out = new Uint8Array(clean.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }

  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  function utf8(bytes) {
    var decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(bytes);
  }

  function concat(chunks) {
    var total = 0, i;
    for (i = 0; i < chunks.length; i++) total += chunks[i].length;
    var out = new Uint8Array(total), offset = 0;
    for (i = 0; i < chunks.length; i++) { out.set(chunks[i], offset); offset += chunks[i].length; }
    return out;
  }

  /* ---------- script parsing ---------- */

  function parseScript(script) {
    var start;
    if (script[0] === 0x6a) start = 0;
    else if (script[0] === 0x00 && script[1] === 0x6a) start = 1;
    else throw new Error('This scriptPubKey does not begin with OP_RETURN (0x6a). It is not a data carrier output.');

    var pushes = [];
    var offset = start + 1;
    while (offset < script.length) {
      var opcode = script[offset];
      var length, dataAt;
      offset += 1;
      if (opcode === 0x00) { length = 0; dataAt = offset; }
      else if (opcode <= 0x4b) { length = opcode; dataAt = offset; }
      else if (opcode === 0x4c) {
        if (offset + 1 > script.length) throw new Error('PUSHDATA1 at offset ' + (offset - 1) + ' is truncated.');
        length = script[offset]; dataAt = offset + 1;
      } else if (opcode === 0x4d) {
        if (offset + 2 > script.length) throw new Error('PUSHDATA2 at offset ' + (offset - 1) + ' is truncated.');
        length = script[offset] | (script[offset + 1] << 8); dataAt = offset + 2;
      } else if (opcode === 0x4e) {
        if (offset + 4 > script.length) throw new Error('PUSHDATA4 at offset ' + (offset - 1) + ' is truncated.');
        length = (script[offset] | (script[offset + 1] << 8) | (script[offset + 2] << 16)) + (script[offset + 3] * 16777216);
        dataAt = offset + 4;
      } else {
        throw new Error('Byte 0x' + opcode.toString(16) + ' at offset ' + (offset - 1) +
          ' is not a data push. The Bitcoin Universe OP-20 and OP Names decoders reject a carrier that contains a non-push opcode.');
      }
      if (dataAt + length > script.length) throw new Error('The data push at offset ' + (offset - 1) + ' claims ' + length + ' bytes but the script ends first.');
      pushes.push({ opcode: opcode, at: offset - 1, dataAt: dataAt, length: length, bytes: script.subarray(dataAt, dataAt + length) });
      offset = dataAt + length;
    }
    return { opReturnAt: start, pushes: pushes, payload: concat(pushes.map(function (p) { return p.bytes; })) };
  }

  /* ---------- shared JSON helpers ---------- */

  function firstJsonObject(text) {
    var start = text.indexOf('{');
    if (start < 0) return null;
    if (text.slice(0, start).trim()) return { leading: true };
    var depth = 0, inString = false, escaped = false;
    for (var i = start; i < text.length; i++) {
      var ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) return { json: text.slice(start, i + 1), suffix: text.slice(i + 1) }; }
    }
    return { incomplete: true };
  }

  function duplicateTopLevelKey(json) {
    var keys = Object.create(null), depth = 0, i = 0;
    while (i < json.length) {
      var ch = json[i];
      if (ch === '{' || ch === '[') { depth += 1; i += 1; continue; }
      if (ch === '}' || ch === ']') { depth -= 1; i += 1; continue; }
      if (ch !== '"') { i += 1; continue; }
      var start = i; i += 1;
      var escaped = false;
      while (i < json.length) {
        var cur = json[i]; i += 1;
        if (escaped) escaped = false;
        else if (cur === '\\') escaped = true;
        else if (cur === '"') break;
      }
      var cursor = i;
      while (/\s/.test(json[cursor] || '')) cursor += 1;
      if (depth === 1 && json[cursor] === ':') {
        var key;
        try { key = JSON.parse(json.slice(start, i)); } catch (e) { return null; }
        if (keys[key]) return key;
        keys[key] = true;
      }
    }
    return null;
  }

  /* ---------- OP-20 ---------- */

  var OP20_FIELDS = {
    deploy: ['p', 'op', 'tick', 'max', 'lim', 'add'],
    mint: ['p', 'op', 'tick', 'amt', 'add'],
    transfer: ['p', 'op', 'tick', 'amt', 'add']
  };
  var ATOMIC = /^(0|[1-9]\d{0,77})$/;

  function normalizeRef(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 400) return null;
    var source = value.normalize('NFC').trim();
    if (!source || source.indexOf('/') >= 0 || source.indexOf('\\') >= 0 || source === '.' || source === '..') return null;
    return source.toLowerCase();
  }

  function decodeOp20(text) {
    var extracted = firstJsonObject(text);
    if (!extracted || extracted.leading || extracted.incomplete || !extracted.json) return null;
    var payload;
    try { payload = JSON.parse(extracted.json); } catch (e) { return null; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.p !== 'op-20') return null;

    var problems = [];
    var duplicate = duplicateTopLevelKey(extracted.json);
    if (duplicate) problems.push('The payload repeats the top level field "' + duplicate + '". The OP-20 reader rejects duplicated fields (protocol_mismatch).');

    var op = typeof payload.op === 'string' ? payload.op.toLowerCase() : '';
    var allowed = OP20_FIELDS[op];
    if (!allowed) {
      problems.push('Operation "' + (payload.op == null ? '(missing)' : String(payload.op)) + '" is not one of deploy, mint or transfer (protocol_mismatch).');
      return { protocol: 'OP-20', id: 'op_return', operation: op || null, fields: payload, problems: problems, suffix: extracted.suffix };
    }
    Object.keys(payload).forEach(function (key) {
      if (allowed.indexOf(key) < 0) problems.push('Unknown field "' + key + '" is not allowed for op "' + op + '" (upstream_schema).');
    });

    var ref = normalizeRef(payload.tick);
    if (ref === null) problems.push('"tick" is not a usable OP-20 token reference.');

    var result = {
      protocol: 'OP-20',
      id: 'op_return',
      operation: op,
      ticker: typeof payload.tick === 'string' ? payload.tick : null,
      ref: ref,
      assetId: ref === null ? null : 'op_return:op20:b64.' + base64url(ref),
      recipient: typeof payload.add === 'string' ? payload.add : null,
      fields: payload,
      problems: problems,
      suffix: extracted.suffix
    };

    if (op === 'deploy') {
      var max = amountField(String(payload.max), /^(0|[1-9]\d{0,77})(?:\.\d{1,77})?$/, 'max');
      var lim = String(payload.lim);
      if (!ATOMIC.test(lim) || lim === '0') problems.push('"lim" must be a positive whole atomic amount.');
      if (max.error) problems.push(max.error);
      result.maximum = max.value;
      result.maximumSource = max.source;
      result.limit = ATOMIC.test(lim) && lim !== '0' ? lim : null;
      if (max.coerced) result.coercion = 'legacy-mysql-bigint-truncation';
    } else {
      var amt = amountField(String(payload.amt), /^(0|[1-9]\d{0,77})(?:\.(0{1,77}))?$/, 'amt');
      if (amt.error) problems.push(amt.error);
      else if (amt.value === '0') problems.push('"amt" of 0 is rejected for ' + op + '; the amount must be positive.');
      result.amount = amt.value;
      result.amountSource = amt.source;
      if (amt.coerced) result.coercion = 'legacy-zero-fraction-truncated-by-mysql-bigint';
    }
    return result;
  }

  function amountField(source, pattern, name) {
    var matched = pattern.exec(source);
    if (!matched) return { value: null, source: source, error: '"' + name + '" (' + source + ') is not accepted. It must be a whole atomic amount, optionally written with a zero fraction.' };
    return { value: matched[1], source: source, coerced: matched[1] !== source };
  }

  function base64url(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* ---------- OP Names ---------- */

  var CONTROL = /[\u0000-\u001f\u007f]/;
  var PATH_SEPARATOR = /[\\/]/;
  var DOT_ALIAS = /[\u00b7\u0387\u2022\u2024\u2027\u2219\u22c5\u3002\u30fb\ufe52\uff0e\uff61\uff65]/;
  var NAMESPACE = /^[a-z0-9]+$/;

  function byteLength(text) { return new TextEncoder().encode(text).length; }

  function normalizeOpName(value) {
    if (typeof value !== 'string') return { error: 'name must be text.' };
    if (CONTROL.test(value)) return { error: 'name cannot contain control characters.' };
    if (PATH_SEPARATOR.test(value)) return { error: 'name cannot contain path separators.' };
    if (DOT_ALIAS.test(value)) return { error: 'name cannot contain a Unicode dot lookalike.' };
    var normalized = value.normalize('NFC').trim().toLowerCase();
    if (!normalized) return { error: 'name is empty after normalisation.' };
    if (byteLength(normalized) > 255) return { error: 'name cannot exceed 255 UTF-8 bytes.' };
    var pieces = normalized.split('.');
    if (pieces.length !== 2 || !pieces[0] || !pieces[1]) return { error: 'name must contain exactly one literal dot with a non-empty label and namespace.' };
    if (!NAMESPACE.test(pieces[1])) return { error: 'namespace "' + pieces[1] + '" must be lowercase ASCII letters and digits only.' };
    if (byteLength(pieces[1]) > 63) return { error: 'namespace cannot exceed 63 UTF-8 bytes.' };
    return { name: normalized, label: pieces[0], namespace: pieces[1], assetId: 'op_names:name:b64.' + base64url(normalized) };
  }

  function decodeOpNames(text) {
    var trimmed = text.trim();
    if (!trimmed) return null;

    if (trimmed.charAt(0) !== '{') {
      var dots = trimmed.match(/\./g);
      if (!dots || dots.length !== 1) return null;
      var plain = normalizeOpName(trimmed);
      return {
        protocol: 'OP Names', id: 'op_names', encoding: 'text', operation: 'reg',
        rawName: trimmed, identity: plain.error ? null : plain,
        problems: plain.error ? ['invalid_op_name: ' + plain.error] : []
      };
    }

    var duplicate = duplicateTopLevelKey(trimmed);
    var payload;
    try { payload = JSON.parse(trimmed); } catch (e) {
      if (trimmed.toLowerCase().indexOf('opns') >= 0) {
        return { protocol: 'OP Names', id: 'op_names', encoding: 'json', operation: null, problems: ['malformed_json: the payload names opns but is not valid JSON, so it is stored as unapplied evidence.'] };
      }
      return null;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.p !== 'opns') return null;

    var problems = [];
    if (duplicate) problems.push('The payload repeats the top level field "' + duplicate + '".');
    var op = payload.op;
    if (op !== 'reg' && op !== 'transfer') {
      return { protocol: 'OP Names', id: 'op_names', encoding: 'json', operation: null, fields: payload, problems: problems.concat(['unsupported_operation: only "reg" and "transfer" are recognised.']) };
    }
    var allowed = op === 'reg' ? ['p', 'op', 'name', 'add'] : ['p', 'op', 'name'];
    Object.keys(payload).forEach(function (key) {
      if (allowed.indexOf(key) < 0) problems.push('unknown_field: "' + key + '" is not allowed for op "' + op + '".');
    });
    if (typeof payload.name !== 'string') problems.push('missing_name: "name" must be a string.');
    if (op === 'reg' && payload.add != null && (typeof payload.add !== 'string' || payload.add.length > 128)) {
      problems.push('invalid_explicit_address: "add" must be a string of at most 128 characters.');
    }
    var identity = typeof payload.name === 'string' ? normalizeOpName(payload.name) : { error: 'name missing' };
    if (identity.error) problems.push('invalid_op_name: ' + identity.error);

    return {
      protocol: 'OP Names', id: 'op_names', encoding: 'json', operation: op,
      rawName: typeof payload.name === 'string' ? payload.name : null,
      explicitAddress: op === 'reg' && typeof payload.add === 'string' ? payload.add : null,
      identity: identity.error ? null : identity,
      fields: payload, problems: problems
    };
  }

  /* ---------- OP Inscriptions ---------- */

  var OPI_TAGS = ['op-inscriptions', 'op_inscriptions', 'op-inscription'];
  var LEGACY_KEYS = ['add', 'address', 'addr', 'to', 'receiver', 'collection'];

  function decodeOpInscriptions(text) {
    var trimmed = text.trim();
    var payload = null;
    try { payload = JSON.parse(trimmed); } catch (e) { payload = null; }
    if (payload === null) {
      var start = trimmed.indexOf('{'), end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) { try { payload = JSON.parse(trimmed.slice(start, end + 1)); } catch (e2) { payload = null; } }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

    var tag = String(payload.p || payload.protocol || payload.proto || '').trim().toLowerCase();
    var address = String(payload.add || payload.address || payload.addr || payload.to || payload.receiver || '').trim();

    if (OPI_TAGS.indexOf(tag) >= 0) {
      return {
        protocol: 'OP Inscriptions', id: 'op_inscriptions', shape: 'tagged',
        operation: String(payload.op || payload.operation || payload.action || '').trim() || 'inscribe',
        address: address || null, fields: payload, problems: []
      };
    }

    var keys = Object.keys(payload);
    if (address && keys.length > 0 && keys.every(function (k) { return LEGACY_KEYS.indexOf(k) >= 0; })) {
      return {
        protocol: 'OP Inscriptions', id: 'op_inscriptions', shape: 'legacy-envelope',
        operation: 'inscribe', address: address, fields: payload,
        problems: [],
        notes: ['Recognised only through the narrow historical envelope: every key is one of ' + LEGACY_KEYS.join(', ') + ' and an address is present. Arbitrary JSON in an OP_RETURN is not an OP inscription.']
      };
    }
    return null;
  }

  /* ---------- media sniffing for OP Inscriptions ---------- */

  function sniffMedia(bytes) {
    function starts(sig) {
      if (bytes.length < sig.length) return false;
      for (var i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return false;
      return true;
    }
    if (starts([0x89, 0x50, 0x4e, 0x47])) return 'image/png';
    if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (starts([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
    if (starts([0x42, 0x4d])) return 'image/bmp';
    if (starts([0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
    return null;
  }

  /* ---------- top level ---------- */

  function decode(hexText) {
    var script = hexToBytes(hexText);
    var parsed = parseScript(script);
    var payload = parsed.payload;

    var out = {
      scriptBytes: script.length,
      payloadBytes: payload.length,
      pushCount: parsed.pushes.length,
      leadingOpFalse: parsed.opReturnAt === 1,
      pushes: parsed.pushes,
      payloadHex: toHex(payload),
      text: null,
      textError: null,
      match: null
    };

    try { out.text = utf8(payload); } catch (e) {
      out.textError = 'The payload is not valid UTF-8, so no text protocol can claim it.';
    }

    if (out.text !== null) {
      out.match = decodeOp20(out.text) || decodeOpNames(out.text) || decodeOpInscriptions(out.text);
    }
    if (!out.match) {
      var mime = sniffMedia(payload);
      if (mime) out.media = mime;
    }
    return out;
  }

  /* ---------- rendering ---------- */

  var form = document.getElementById('decoder-form');
  if (!form) return;
  var input = document.getElementById('decoder-input');
  var target = document.getElementById('decoder-output');
  var fallback = document.getElementById('decoder-fallback');
  if (fallback) fallback.hidden = true;
  form.hidden = false;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function kv(pairs) {
    var dl = el('dl', 'kv');
    pairs.forEach(function (pair) {
      if (pair[1] == null || pair[1] === '') return;
      dl.appendChild(el('dt', null, pair[0]));
      dl.appendChild(el('dd', null, String(pair[1])));
    });
    return dl;
  }

  function frame(result) {
    var scroll = el('div', 'frame-scroll');
    var f = el('div', 'frame');
    var row = el('div', 'frame-row');

    if (result.leadingOpFalse) {
      var zero = el('div', 'fld');
      zero.appendChild(el('span', 'off', 'byte 0'));
      zero.appendChild(el('span', 'val', '00'));
      zero.appendChild(el('span', 'nm', 'OP_0'));
      row.appendChild(zero);
    }
    var op = el('div', 'fld op');
    op.appendChild(el('span', 'off', 'byte ' + (result.leadingOpFalse ? 1 : 0)));
    op.appendChild(el('span', 'val', '6a'));
    op.appendChild(el('span', 'nm', 'OP_RETURN'));
    row.appendChild(op);

    result.pushes.forEach(function (push, i) {
      var prefix = el('div', 'fld');
      prefix.appendChild(el('span', 'off', 'byte ' + push.at + '..' + (push.dataAt - 1)));
      prefix.appendChild(el('span', 'val', toHex(new Uint8Array([push.opcode])) + (push.dataAt - push.at > 1 ? ' ..' : '')));
      prefix.appendChild(el('span', 'nm', pushName(push)));
      row.appendChild(prefix);

      var data = el('div', 'fld pay');
      data.appendChild(el('span', 'off', 'byte ' + push.dataAt + '..' + (push.dataAt + push.length - 1)));
      var hex = toHex(push.bytes);
      data.appendChild(el('span', 'val', hex.length > 48 ? hex.slice(0, 24) + '...' + hex.slice(-16) : hex || '(empty)'));
      data.appendChild(el('span', 'nm', 'push ' + (i + 1) + ' data, ' + push.length + ' B'));
      row.appendChild(data);
    });

    f.appendChild(row);
    scroll.appendChild(f);
    return scroll;
  }

  function pushName(push) {
    if (push.opcode === 0x00) return 'OP_0';
    if (push.opcode <= 0x4b) return 'direct push';
    if (push.opcode === 0x4c) return 'PUSHDATA1';
    if (push.opcode === 0x4d) return 'PUSHDATA2';
    return 'PUSHDATA4';
  }

  function standardness(result) {
    var box = el('div', 'note');
    box.appendChild(el('strong', null, 'Size and relay policy'));
    var p = el('p');
    p.textContent = 'The scriptPubKey is ' + result.scriptBytes + ' bytes and carries ' + result.payloadBytes +
      ' payload bytes across ' + result.pushCount + ' push' + (result.pushCount === 1 ? '' : 'es') + '. ';
    if (result.scriptBytes <= LEGACY_RELAY_SCRIPT_BYTES) {
      p.textContent += 'That fits inside the long standing 83 byte default data carrier limit, so it relays under both old and current default policy.';
    } else {
      p.textContent += 'That exceeds the long standing 83 byte default data carrier limit, so nodes still running that older default policy will not relay it. Relay policy is not consensus: a miner can include the transaction regardless.';
    }
    box.appendChild(p);
    var q = el('p');
    q.textContent = 'The Bitcoin Universe OP Names reader refuses any carrier whose assembled payload exceeds ' + MAX_CARRIER_BYTES +
      ' bytes. This payload is ' + (result.payloadBytes > MAX_CARRIER_BYTES ? 'over' : 'within') + ' that bound.';
    box.appendChild(q);
    return box;
  }

  function render(result) {
    target.innerHTML = '';
    var card = el('div', 'verdict');

    var badge, headline;
    if (result.match) {
      var clean = !result.match.problems || result.match.problems.length === 0;
      badge = el('span', 'badge ' + (clean ? 'ok' : 'err'), result.match.protocol + (clean ? ' payload' : ' payload, rejected'));
      headline = clean
        ? 'This output carries an ' + result.match.protocol + ' payload that the Bitcoin Universe reader accepts.'
        : 'This output looks like ' + result.match.protocol + ', but the reader rejects it. It is kept as evidence and never becomes an asset.';
    } else {
      badge = el('span', 'badge none', 'no supported protocol');
      headline = 'This is a valid OP_RETURN data carrier, but the payload matches none of OP-20, OP Names or OP Inscriptions.';
    }
    card.appendChild(badge);
    card.appendChild(el('p', null, headline));
    card.appendChild(frame(result));

    var pairs = [
      ['carrier', result.leadingOpFalse ? 'OP_0 OP_RETURN (accepted only by the OP Inscriptions scanner)' : 'OP_RETURN'],
      ['script bytes', result.scriptBytes],
      ['payload bytes', result.payloadBytes],
      ['pushes', result.pushCount],
      ['payload hex', result.payloadHex || '(empty)']
    ];
    if (result.text !== null) pairs.push(['payload as text', result.text]);
    if (result.textError) pairs.push(['text', result.textError]);
    if (result.media) pairs.push(['sniffed media type', result.media + ' (OP Inscriptions treats renderable media as inscription content)']);
    card.appendChild(kv(pairs));

    if (result.match) {
      var m = result.match;
      card.appendChild(el('h3', null, m.protocol + ' fields'));
      var detail = [
        ['registry id', m.id],
        ['operation', m.operation],
        ['encoding', m.encoding || m.shape || 'json']
      ];
      if (m.protocol === 'OP-20') {
        detail.push(['ticker as written', m.ticker]);
        detail.push(['normalised reference', m.ref]);
        detail.push(['stable asset id', m.assetId]);
        detail.push(['maximum supply', m.maximum]);
        detail.push(['mint limit', m.limit]);
        detail.push(['amount', m.amount]);
        if (m.amountSource && m.amount !== m.amountSource) detail.push(['amount as written', m.amountSource]);
        if (m.maximumSource && m.maximum !== m.maximumSource) detail.push(['maximum as written', m.maximumSource]);
        detail.push(['explicit recipient', m.recipient]);
        detail.push(['coercion applied', m.coercion]);
        if (m.suffix && m.suffix.trim()) detail.push(['trailing bytes after the JSON object', m.suffix.trim() + ' (kept as a suffix, not part of the payload fields)']);
      }
      if (m.protocol === 'OP Names') {
        detail.push(['name as written', m.rawName]);
        if (m.identity) {
          detail.push(['normalised name', m.identity.name]);
          detail.push(['label', m.identity.label]);
          detail.push(['namespace', m.identity.namespace]);
          detail.push(['stable asset id', m.identity.assetId]);
        }
        detail.push(['explicit address', m.explicitAddress]);
      }
      if (m.protocol === 'OP Inscriptions') {
        detail.push(['recipient', m.address]);
        detail.push(['shape', m.shape === 'legacy-envelope' ? 'historical narrow envelope' : 'explicit protocol tag']);
      }
      card.appendChild(kv(detail));

      if (m.notes && m.notes.length) {
        var info = el('div', 'note');
        info.appendChild(el('strong', null, 'How it was recognised'));
        m.notes.forEach(function (note) { info.appendChild(el('p', null, note)); });
        card.appendChild(info);
      }

      if (m.problems && m.problems.length) {
        var bad = el('div', 'note bad');
        bad.appendChild(el('strong', null, 'Why the reader rejects it'));
        var ul = el('ul');
        m.problems.forEach(function (problem) { ul.appendChild(el('li', null, problem)); });
        bad.appendChild(ul);
        card.appendChild(bad);
      }

      var ctx = el('div', 'note');
      ctx.appendChild(el('strong', null, 'What this means in Bitcoin Universe products'));
      if (m.id === 'op_return') {
        ctx.appendChild(el('p', null, 'OP-20 is viewable in Core: view, view-collection and view-activity are read-only. Listing, buying, offers, settlement and reconciliation are not supported on that surface.'));
      } else if (m.id === 'op_names') {
        ctx.appendChild(el('p', null, 'OP Names is viewable in Core on the same read-only terms as OP-20. Its raw block authority is code complete but deliberately not production enabled.'));
      } else {
        ctx.appendChild(el('p', null, 'OP Inscriptions is the one protocol on this carrier that Core executes: view, view-collection, view-activity, list, unlist, buy, settle and reconcile all run in app. There is no atomic listing update, so a price change means cancel and relist.'));
      }
      card.appendChild(ctx);
    } else {
      var hint = el('div', 'note');
      hint.appendChild(el('strong', null, 'Reading an unrecognised carrier'));
      hint.appendChild(el('p', null, 'An OP_RETURN with no protocol tag is still a perfectly valid Bitcoin output. It is provably unspendable and the node can drop it from the UTXO set. It simply carries no meaning that these three indexers act on.'));
      card.appendChild(hint);
    }

    card.appendChild(standardness(result));
    target.appendChild(card);
  }

  function renderError(message) {
    target.innerHTML = '';
    var card = el('div', 'verdict');
    card.appendChild(el('span', 'badge err', 'cannot decode'));
    card.appendChild(el('p', null, message));
    target.appendChild(card);
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    try { render(decode(input.value)); } catch (error) { renderError(error.message); }
  });

  var reset = document.getElementById('decoder-clear');
  if (reset) reset.addEventListener('click', function () {
    input.value = '';
    target.innerHTML = '';
    input.focus();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-sample]'), function (button) {
    button.addEventListener('click', function () {
      input.value = button.getAttribute('data-sample');
      try { render(decode(input.value)); } catch (error) { renderError(error.message); }
      target.scrollIntoView({ block: 'nearest' });
    });
  });
}());
