/**
 * board-engine.js
 *
 * Browser-side Whiteboard Drawing Engine.
 * Combines Rough.js for hand-drawn shapes, Hershey Simplex vector font for
 * handwriting strokes, Indic text fallback with clip-rect reveal, and
 * an auto-layout compiler for nodes, edges, notes, and heading.
 *
 * Exported globally as window.Board.
 */

(function() {
  'use strict';

  // ─── Font & Stroke Utilities ───────────────────────────────────────────────

  function isIndicCode(code) {
    // Devanagari (0900-097F), Bengali (0980-09FF), Gurmukhi (0A00-0A7F),
    // Gujarati (0A80-0AFF), Oriya (0B00-0B7F), Tamil (0B80-0BFF),
    // Telugu (0C00-0C7F), Kannada (0C80-0CFF), Malayalam (0D00-0D7F)
    return (code >= 0x0900 && code <= 0x0D7F);
  }

  function splitIntoScriptRuns(text) {
    if (!text) return [];
    var runs = [];
    var currentText = '';
    var currentIsIndic = null;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var isIndic = isIndicCode(ch.charCodeAt(0));
      if (currentIsIndic === null) {
        currentIsIndic = isIndic;
        currentText = ch;
      } else if (isIndic === currentIsIndic) {
        currentText += ch;
      } else {
        runs.push({ text: currentText, isIndic: currentIsIndic });
        currentText = ch;
        currentIsIndic = isIndic;
      }
    }
    if (currentText) {
      runs.push({ text: currentText, isIndic: currentIsIndic });
    }
    return runs;
  }

  /**
   * Convert Latin string to Hershey stroke paths.
   */
  function hersheyTextToStrokes(str, startX, startY, fontSize) {
    var fontData = window.HERSHEY_FONT && window.HERSHEY_FONT.futural;
    var scale = fontSize / 24;
    var curX = startX;
    var strokes = [];

    if (!fontData || !fontData.chars) {
      return { strokes: [], totalWidth: str.length * 12 * scale };
    }

    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code === 32) {
        curX += 12 * scale;
        continue;
      }
      var ch = fontData.chars[code - 33];
      if (!ch || !ch.d) {
        curX += 12 * scale;
        continue;
      }

      var parts = ch.d.split('M').filter(Boolean);
      for (var p = 0; p < parts.length; p++) {
        var tokens = parts[p].trim().replace(/^L/, '').trim().split(/\s+|L/).filter(Boolean);
        var pts = [];
        for (var k = 0; k < tokens.length; k++) {
          var pair = tokens[k].split(',');
          var px = parseFloat(pair[0]);
          var py = parseFloat(pair[1]);
          if (!isNaN(px) && !isNaN(py)) {
            pts.push({
              x: curX + px * scale,
              y: startY + py * scale
            });
          }
        }
        if (pts.length >= 2) {
          strokes.push(pts);
        }
      }
      curX += (ch.o || 14) * scale;
    }

    return { strokes: strokes, totalWidth: curX - startX };
  }

  // ─── Drawing Primitives & Deterministic PRNG ───────────────────────────────

  var DRAWING_PRESETS = {
    clean: { roughness: 0, bowing: 0, strokeWidthVariation: 0, doubleStroke: false },
    hand_drawn: { roughness: 2.5, bowing: 2.0, strokeWidthVariation: 0.18, doubleStroke: false },
    sketchy: { roughness: 4.0, bowing: 3.5, strokeWidthVariation: 0.30, doubleStroke: true }
  };

  function hashString(str) {
    if (!str) return 12345;
    var hash = 5381;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash) + s.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) || 12345;
  }

  function createRng(seed) {
    var s = (seed || 12345) >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resolveStyle(boardData) {
    var data = boardData || {};
    var styleName = data.drawingStyle || 'hand_drawn';
    var preset = DRAWING_PRESETS[styleName] || DRAWING_PRESETS.hand_drawn;

    var seedVal;
    if (typeof data.seed === 'number' && !isNaN(data.seed)) {
      seedVal = data.seed;
    } else if (typeof data.seed === 'string' && data.seed.trim()) {
      seedVal = hashString(data.seed.trim());
    } else {
      var seedStr = (data.heading || '') + '_' + (data.subheading || '') + '_' + ((data.nodes && data.nodes.length) || 0);
      seedVal = hashString(seedStr);
    }

    return {
      drawingStyle: styleName,
      roughness: typeof data.roughness === 'number' ? data.roughness : preset.roughness,
      bowing: typeof data.bowing === 'number' ? data.bowing : preset.bowing,
      strokeWidthVariation: typeof data.strokeWidthVariation === 'number' ? data.strokeWidthVariation : preset.strokeWidthVariation,
      doubleStroke: typeof data.doubleStroke === 'boolean' ? data.doubleStroke : preset.doubleStroke,
      seed: seedVal,
      useRoughJs: data.useRoughJs === true
    };
  }

  // ─── Hand-Drawn Geometry Engine ─────────────────────────────────────────────

  function sampleCubicBezier(p0, p1, p2, p3, steps) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var mt = 1 - t;
      var x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
      var y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
      pts.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    }
    return pts;
  }

  function generateHandDrawnLine(x1, y1, x2, y2, opts, rng) {
    if (!opts || opts.roughness === 0) {
      return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    }

    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];

    var nx = -dy / len;
    var ny = dx / len;

    var bowing = typeof opts.bowing === 'number' ? opts.bowing : 0.6;
    var roughness = typeof opts.roughness === 'number' ? opts.roughness : 0.8;

    var bow = (rng() - 0.5) * bowing * Math.min(12, len * 0.08);
    var d1 = (rng() - 0.5) * roughness * 4.5;
    var d2 = (rng() - 0.5) * roughness * 4.5;

    var p0 = { x: x1, y: y1 };
    var p1 = { x: x1 + dx * 0.33 + (bow + d1) * nx, y: y1 + dy * 0.33 + (bow + d1) * ny };
    var p2 = { x: x1 + dx * 0.67 + (bow + d2) * nx, y: y1 + dy * 0.67 + (bow + d2) * ny };
    var p3 = { x: x2, y: y2 };

    return sampleCubicBezier(p0, p1, p2, p3, Math.max(10, Math.min(24, Math.floor(len / 8))));
  }

  function generateHandDrawnRect(x, y, w, h, opts, rng) {
    if (!opts || opts.roughness === 0) {
      return [
        { x: x, y: y },
        { x: x + w, y: y },
        { x: x + w, y: y + h },
        { x: x, y: y + h },
        { x: x, y: y }
      ];
    }

    var r = opts.roughness;
    var cornerJitter = function() { return (rng() - 0.5) * r * 4.0; };

    var pTL = { x: x + cornerJitter(), y: y + cornerJitter() };
    var pTR = { x: x + w + cornerJitter(), y: y + cornerJitter() };
    var pBR = { x: x + w + cornerJitter(), y: y + h + cornerJitter() };
    var pBL = { x: x + cornerJitter(), y: y + h + cornerJitter() };

    var top = generateHandDrawnLine(pTL.x, pTL.y, pTR.x, pTR.y, opts, rng);
    var right = generateHandDrawnLine(pTR.x, pTR.y, pBR.x, pBR.y, opts, rng);
    var bottom = generateHandDrawnLine(pBR.x, pBR.y, pBL.x, pBL.y, opts, rng);
    var left = generateHandDrawnLine(pBL.x, pBL.y, pTL.x, pTL.y, opts, rng);

    var res = top.slice();
    for (var i = 1; i < right.length; i++) res.push(right[i]);
    for (var j = 1; j < bottom.length; j++) res.push(bottom[j]);
    for (var k = 1; k < left.length; k++) res.push(left[k]);
    res.push({ x: pTL.x, y: pTL.y }); // Ensure closed cleanly
    return res;
  }

  function generateHandDrawnEllipse(cx, cy, rx, ry, opts, rng) {
    if (!opts || opts.roughness === 0) {
      var cleanPts = [];
      for (var c = 0; c <= 32; c++) {
        var ca = (c / 32) * 2 * Math.PI;
        cleanPts.push({ x: Number((cx + rx * Math.cos(ca)).toFixed(2)), y: Number((cy + ry * Math.sin(ca)).toFixed(2)) });
      }
      return cleanPts;
    }

    var pts = [];
    var count = 36;
    var phase = rng() * Math.PI * 2;
    var r = opts.roughness;

    for (var i = 0; i <= count; i++) {
      var a = (i / count) * 2 * Math.PI;
      var wobble = 1.0 + r * 0.06 * Math.sin(2 * a + phase) + (rng() - 0.5) * r * 0.05;
      var px = cx + rx * wobble * Math.cos(a);
      var py = cy + ry * wobble * Math.sin(a);
      pts.push({ x: Number(px.toFixed(2)), y: Number(py.toFixed(2)) });
    }
    pts[pts.length - 1] = { x: pts[0].x, y: pts[0].y };
    return pts;
  }

  function generateHandDrawnRhombus(x, y, w, h, opts, rng) {
    var midX = x + w / 2;
    var midY = y + h / 2;

    if (!opts || opts.roughness === 0) {
      return [
        { x: midX, y: y },
        { x: x + w, y: midY },
        { x: midX, y: y + h },
        { x: x, y: midY },
        { x: midX, y: y }
      ];
    }

    var r = opts.roughness;
    var j = function() { return (rng() - 0.5) * r * 4.0; };

    var top = { x: midX + j(), y: y + j() };
    var right = { x: x + w + j(), y: midY + j() };
    var bottom = { x: midX + j(), y: y + h + j() };
    var left = { x: x + j(), y: midY + j() };

    var s1 = generateHandDrawnLine(top.x, top.y, right.x, right.y, opts, rng);
    var s2 = generateHandDrawnLine(right.x, right.y, bottom.x, bottom.y, opts, rng);
    var s3 = generateHandDrawnLine(bottom.x, bottom.y, left.x, left.y, opts, rng);
    var s4 = generateHandDrawnLine(left.x, left.y, top.x, top.y, opts, rng);

    var res = s1.slice();
    for (var a = 1; a < s2.length; a++) res.push(s2[a]);
    for (var b = 1; b < s3.length; b++) res.push(s3[b]);
    for (var c = 1; c < s4.length; c++) res.push(s4[c]);
    res.push({ x: top.x, y: top.y });
    return res;
  }

  function generateHandDrawnPath(points, opts, rng) {
    if (!points || points.length < 2) return points || [];
    if (!opts || opts.roughness === 0) return points;

    var res = [];
    for (var i = 0; i < points.length - 1; i++) {
      var seg = generateHandDrawnLine(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, opts, rng);
      if (i === 0) {
        res = seg.slice();
      } else {
        for (var s = 1; s < seg.length; s++) res.push(seg[s]);
      }
    }
    return res;
  }

  function drawPointPath(ctx, points, t, color, lineWidth, strokeVariation) {
    if (!points || points.length < 2 || t <= 0) return null;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var total = points.length;
    var drawCount = Math.max(2, Math.floor(t * total));
    var partialT = (t * total) - Math.floor(t * total);
    var baseWidth = lineWidth || 2;
    var variation = typeof strokeVariation === 'number' ? strokeVariation : 0.25;

    // Draw segments with varying stroke width for hand-drawn feel
    var tipX = points[0].x;
    var tipY = points[0].y;

    if (variation > 0 && baseWidth >= 1.5) {
      // Segment-by-segment drawing with width variation
      for (var p = 1; p < drawCount && p < total; p++) {
        var widthFactor = 1.0 + variation * Math.sin(p * 0.7) * 0.5 + variation * Math.cos(p * 1.3) * 0.3;
        ctx.lineWidth = Math.max(0.8, baseWidth * widthFactor);
        ctx.beginPath();
        ctx.moveTo(points[p - 1].x, points[p - 1].y);
        ctx.lineTo(points[p].x, points[p].y);
        ctx.stroke();
        tipX = points[p].x;
        tipY = points[p].y;
      }

      if (drawCount < total && partialT > 0) {
        var pNext = points[drawCount];
        tipX = tipX + (pNext.x - tipX) * partialT;
        tipY = tipY + (pNext.y - tipY) * partialT;
        ctx.lineWidth = baseWidth;
        ctx.beginPath();
        ctx.moveTo(points[Math.min(total - 1, drawCount - 1)].x, points[Math.min(total - 1, drawCount - 1)].y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }
    } else {
      // Uniform width (clean mode or thin strokes)
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (var q = 1; q < drawCount && q < total; q++) {
        ctx.lineTo(points[q].x, points[q].y);
      }

      tipX = points[Math.min(total - 1, drawCount - 1)].x;
      tipY = points[Math.min(total - 1, drawCount - 1)].y;

      if (drawCount < total && partialT > 0) {
        var pN = points[drawCount];
        tipX = tipX + (pN.x - tipX) * partialT;
        tipY = tipY + (pN.y - tipY) * partialT;
        ctx.lineTo(tipX, tipY);
      }
      ctx.stroke();
    }

    ctx.restore();
    return { x: tipX, y: tipY };
  }

  function drawStrokeList(ctx, strokeList, t, color, lineWidth) {
    if (!strokeList || strokeList.length === 0 || t <= 0) return null;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var totalStrokes = strokeList.length;
    var fullCount = Math.floor(t * totalStrokes);
    var partialIndex = fullCount;
    var partialProgress = (t * totalStrokes) - fullCount;
    var lastPt = null;

    for (var i = 0; i < fullCount && i < totalStrokes; i++) {
      var pts = strokeList[i];
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length; j++) {
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.stroke();
      lastPt = pts[pts.length - 1];
    }

    // Draw partial stroke
    if (partialIndex < totalStrokes && partialProgress > 0) {
      var pPts = strokeList[partialIndex];
      if (pPts.length >= 2) {
        var maxLen = Math.max(2, Math.floor(partialProgress * pPts.length));
        ctx.beginPath();
        ctx.moveTo(pPts[0].x, pPts[0].y);
        for (var pj = 1; pj < maxLen; pj++) {
          ctx.lineTo(pPts[pj].x, pPts[pj].y);
        }
        ctx.stroke();
        lastPt = pPts[maxLen - 1];
      }
    }

    ctx.restore();
    return lastPt;
  }

  function drawRoughOps(ctx, ops, t, color, lineWidth) {
    if (!ops || ops.length === 0 || t <= 0) return null;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var drawCount = Math.max(1, Math.floor(t * ops.length));
    var lastPt = null;
    ctx.beginPath();
    for (var i = 0; i < drawCount && i < ops.length; i++) {
      var op = ops[i];
      var d = op.data;
      if (op.op === 'move') {
        ctx.moveTo(d[0], d[1]);
        lastPt = { x: d[0], y: d[1] };
      } else if (op.op === 'lineTo') {
        ctx.lineTo(d[0], d[1]);
        lastPt = { x: d[0], y: d[1] };
      } else if (op.op === 'bcurveTo') {
        ctx.bezierCurveTo(d[0], d[1], d[2], d[3], d[4], d[5]);
        lastPt = { x: d[4], y: d[5] };
      } else if (op.op === 'qcurveTo') {
        ctx.quadraticCurveTo(d[0], d[1], d[2], d[3]);
        lastPt = { x: d[2], y: d[3] };
      }
    }
    ctx.stroke();
    ctx.restore();
    return lastPt;
  }

  function drawArrowhead(ctx, x1, y1, x2, y2, size, color) {
    if (size <= 0) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    var angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6),
               y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6),
               y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw an animated digital stylus pen cursor at the active stroke tip coordinate.
   */
  function drawPenCursor(ctx, x, y) {
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);

    // Subtle drop shadow for floating pen effect
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Stylus nib (active drawing tip)
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(3.5, -7);
    ctx.lineTo(-3.5, -7);
    ctx.closePath();
    ctx.fill();

    // Metallic collar
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-3, -11, 6, 4);

    // Pen barrel body
    var barrelGrad = ctx.createLinearGradient(-4, -11, 4, -36);
    barrelGrad.addColorStop(0, '#1e293b');
    barrelGrad.addColorStop(0.5, '#334155');
    barrelGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = barrelGrad;
    ctx.beginPath();
    ctx.moveTo(-3.5, -11);
    ctx.lineTo(-2.5, -36);
    ctx.lineTo(2.5, -36);
    ctx.lineTo(3.5, -11);
    ctx.closePath();
    ctx.fill();

    // Stylus accent stripe
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-0.8, -32, 1.6, 12);

    ctx.restore();
  }

  // ─── Text Layout & Wrapping Utilities ──────────────────────────────────────

  /**
   * Split a label into clean, balanced lines to fit inside whiteboard shapes.
   * Handles "Concept (Detail)", explicit newlines, and long multi-word phrases.
   */
  function formatLabelLines(label) {
    if (!label) return [];
    var str = String(label).trim();
    if (!str) return [];

    // Explicit newlines take priority
    if (str.indexOf('\n') !== -1) {
      return str.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    }

    // Pattern: "Concept (Detail)" or "Concept [Detail]"
    var parenMatch = str.match(/^(.*?)\s*([(\[][^)\]]+[)\]])\s*$/);
    if (parenMatch && parenMatch[1].trim() && parenMatch[2].trim()) {
      return [parenMatch[1].trim(), parenMatch[2].trim()];
    }

    // Split long multi-word labels (> 13 chars) into two balanced lines
    var words = str.split(/\s+/);
    if (words.length >= 2 && str.length > 13) {
      var halfLen = str.length / 2;
      var bestIdx = 1;
      var minDiff = 999;
      var curLen = 0;
      for (var w = 0; w < words.length - 1; w++) {
        curLen += words[w].length + 1;
        var diff = Math.abs(curLen - halfLen);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = w + 1;
        }
      }
      return [words.slice(0, bestIdx).join(' '), words.slice(bestIdx).join(' ')];
    }

    return [str];
  }

  function isCodeSnippet(text) {
    if (!text || typeof text !== 'string') return false;
    return /\b(def|return|function|class|if|else|for|while|import|from|print|greet)\b/i.test(text) ||
           /[(){}\[\]=>]/.test(text) ||
           text.includes('"') || text.includes("'");
  }

  // ─── Layout Engine ────────────────────────────────────────────────────────

  /**
   * Compiles board data (nodes, edges, notes, heading, or direct strokes)
   * into a list of drawable animation items with layout geometry.
   */
  function compileBoardLayout(board, canvasW, canvasH, opts) {
    opts = opts || {};
    var rc = (typeof window.rough !== 'undefined') ? window.rough.canvas(document.createElement('canvas')) : null;
    var gen = rc ? rc.generator : null;

    var items = [];
    var heading = board.heading;
    var slideHeading = (opts.slideHeading || '').trim().toLowerCase();

    // 1. Heading (top-left or centered)
    var hasHeading = false;
    var headingY = 36;
    if (heading && typeof heading === 'string') {
      var headingClean = heading.trim();
      var words = headingClean.split(/\s+/);
      if (words.length <= 5 && headingClean.toLowerCase() !== slideHeading) {
        items.push({
          type: 'heading',
          text: headingClean,
          align: 'left',
          x: 40,
          y: headingY,
          fontSize: 26,
          color: '#1e293b'
        });
        hasHeading = true;
      }
    }

    // Subtitle
    var hasSubheading = false;
    var subY = hasHeading ? 66 : 36;
    if (board.subheading && typeof board.subheading === 'string') {
      items.push({
        type: 'subheading',
        text: board.subheading.trim(),
        align: 'left',
        x: 40,
        y: subY,
        fontSize: 18,
        color: '#475569'
      });
      hasSubheading = true;
    }

    // Underline - positioned cleanly BELOW the lowest heading text
    if (board.underline || ((hasHeading || hasSubheading) && board.underline !== false)) {
      var underlineY = (hasHeading && hasSubheading) ? 86 : 56;
      items.push({
        type: 'underline',
        x1: 40,
        x2: Math.min(canvasW - 40, 320),
        y: underlineY,
        color: '#2563eb',
        width: 3
      });
    }

    // Direct strokes fallback
    if (Array.isArray(board.strokes) && board.strokes.length > 0) {
      for (var sIdx = 0; sIdx < board.strokes.length; sIdx++) {
        var s = board.strokes[sIdx];
        items.push(Object.assign({ type: s.type || 'stroke' }, s));
      }
      return items;
    }

    var nodes = Array.isArray(board.nodes) ? board.nodes : [];
    var edges = Array.isArray(board.edges) ? board.edges : [];
    var notes = Array.isArray(board.notes) ? board.notes : [];

    var topMargin = 50;
    if (hasHeading && hasSubheading) topMargin = 115;
    else if (hasHeading || hasSubheading) topMargin = 85;

    var bottomMargin = notes.length > 0 ? 60 : 35;
    var availableH = Math.max(220, canvasH - topMargin - bottomMargin);
    var availableW = Math.max(320, canvasW - 80);

    var nodeMap = {};
    var layout = (board.layout || 'horizontal').toLowerCase();
    var nodeCount = nodes.length;

    // Multi-step sequential execution flow (e.g. Example B with 6-10 steps)
    if (nodeCount >= 6 && (layout === 'vertical' || layout === 'flowchart')) {
      var half = Math.ceil(nodeCount / 2);
      var colW = Math.floor((availableW - 50) / 2);
      var nW = Math.min(320, colW);
      var nH = Math.min(65, Math.floor((availableH - (half - 1) * 14) / half));

      for (var ni = 0; ni < nodeCount; ni++) {
        var rawN = nodes[ni];
        var col = Math.floor(ni / half);
        var row = ni % half;
        var posX = 40 + col * (colW + 50) + (colW - nW) / 2;
        var posY = topMargin + row * (nH + 14);

        var nLines = formatLabelLines(rawN.label || '');
        var nObjMulti = {
          id: String(rawN.id || 'node_' + ni),
          label: rawN.label || '',
          lines: nLines,
          shape: rawN.shape || 'rect',
          x: posX,
          y: posY,
          w: nW,
          h: nH,
          color: rawN.shape === 'rhombus' ? '#ea580c' : (rawN.color || '#2563eb'),
          fill: rawN.fill || 'rgba(37, 99, 235, 0.05)',
          sentenceIndex: rawN.sentenceIndex
        };
        nodeMap[nObjMulti.id] = nObjMulti;
        items.push(Object.assign({ type: 'node' }, nObjMulti));
      }

      // If no explicit edges were provided for multi-step, connect sequentially
      if (edges.length === 0) {
        for (var ei = 0; ei < nodeCount - 1; ei++) {
          edges.push({
            from: String(nodes[ei].id || 'node_' + ei),
            to: String(nodes[ei + 1].id || 'node_' + (ei + 1)),
            arrow: true
          });
        }
      }
    } else {
      // Standard responsive auto-layout
      var defaultGap = 40;
      if (nodeCount <= 2) defaultGap = 60;
      else if (nodeCount === 3) defaultGap = 45;
      else if (nodeCount === 4) defaultGap = 32;
      else defaultGap = 20;

      var computedNodeW;
      var computedNodeH;

      if (layout === 'horizontal' || layout === 'array') {
        var hGap = (nodeCount <= 2) ? 40 : (nodeCount === 3 ? 30 : (nodeCount === 4 ? 22 : 16));
        var availableRowW = Math.max(300, canvasW - 80);
        var maxWPerNode = Math.floor((availableRowW - (nodeCount - 1) * hGap) / Math.max(1, nodeCount));
        computedNodeW = Math.min(220, Math.max(105, maxWPerNode));
        computedNodeH = Math.min(125, Math.max(85, Math.floor(availableH * 0.28)));
      } else if (layout === 'vertical' || layout === 'stack') {
        computedNodeW = Math.min(360, Math.max(220, Math.floor(availableW * 0.70)));
        var maxHPerNode = Math.floor((availableH - (nodeCount - 1) * defaultGap) / Math.max(1, nodeCount));
        computedNodeH = Math.min(115, Math.max(75, maxHPerNode));
      } else {
        var cols = nodeCount > 4 ? 3 : 2;
        var cellW = availableW / cols;
        var cellH = Math.min(140, availableH / Math.ceil(nodeCount / cols));
        computedNodeW = Math.min(240, Math.max(150, cellW - 35));
        computedNodeH = Math.min(110, Math.max(80, cellH - 20));
      }

      for (var i = 0; i < nodeCount; i++) {
        var n = nodes[i];
        var hasCustomW = typeof n.w === 'number' && n.w > 0;
        var hasCustomH = typeof n.h === 'number' && n.h > 0;
        var nodeW = hasCustomW ? n.w : computedNodeW;
        var nodeH = hasCustomH ? n.h : computedNodeH;

        if (!hasCustomW && (n.shape === 'ellipse' || n.shape === 'circle')) {
          nodeW = Math.min(Math.floor((availableW - (nodeCount - 1) * defaultGap) / Math.max(1, nodeCount)), Math.round(nodeW * 1.05));
          nodeH = Math.round(nodeH * 1.05);
        }

        var nodeX = n.x;
        var nodeY = n.y;

        if (typeof nodeX !== 'number' || typeof nodeY !== 'number') {
          if (layout === 'horizontal' || layout === 'array') {
            var actualGap = Math.max(14, Math.floor((availableW - nodeCount * nodeW) / Math.max(1, nodeCount - 1)));
            var totalRowW = nodeCount * nodeW + (nodeCount - 1) * actualGap;
            var startX = Math.max(25, (canvasW - totalRowW) / 2);
            if (startX + totalRowW > canvasW - 20) {
              startX = Math.max(20, canvasW - totalRowW - 20);
            }
            nodeX = startX + i * (nodeW + actualGap);
            nodeY = topMargin + (availableH - nodeH) / 2;
          } else if (layout === 'vertical' || layout === 'stack') {
            var actualGapV = Math.max(16, Math.floor((availableH - nodeCount * nodeH) / Math.max(1, nodeCount - 1)));
            var totalColH = nodeCount * nodeH + (nodeCount - 1) * actualGapV;
            var startY = topMargin + Math.max(15, (availableH - totalColH) / 2);
            nodeX = (canvasW - nodeW) / 2;
            nodeY = startY + i * (nodeH + actualGapV);
          } else {
            var gCols = nodeCount > 4 ? 3 : 2;
            var cIdx = i % gCols;
            var rIdx = Math.floor(i / gCols);
            var gCellW = availableW / gCols;
            var gCellH = Math.min(140, availableH / Math.ceil(nodeCount / gCols));
            nodeX = 40 + cIdx * gCellW + (gCellW - nodeW) / 2;
            nodeY = topMargin + rIdx * gCellH + (gCellH - nodeH) / 2;
          }
        }

        var nodeLines = formatLabelLines(n.label || '');
        var nodeObj = {
          id: String(n.id || 'node_' + i),
          label: n.label || '',
          lines: nodeLines,
          shape: n.shape || 'rect',
          x: nodeX,
          y: nodeY,
          w: nodeW,
          h: nodeH,
          color: n.shape === 'rhombus' ? '#ea580c' : (n.color || '#2563eb'),
          fill: n.fill || 'rgba(37, 99, 235, 0.05)',
          sentenceIndex: n.sentenceIndex
        };

        nodeMap[nodeObj.id] = nodeObj;
        items.push(Object.assign({ type: 'node' }, nodeObj));
      }
    }

    // Connectors / Edges
    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e];
      var fromNode = nodeMap[String(edge.from)];
      var toNode = nodeMap[String(edge.to)];
      if (!fromNode || !toNode) continue;

      var x1 = fromNode.x + fromNode.w / 2;
      var y1 = fromNode.y + fromNode.h / 2;
      var x2 = toNode.x + toNode.w / 2;
      var y2 = toNode.y + toNode.h / 2;

      var dx = x2 - x1;
      var dy = y2 - y1;
      var angle = Math.atan2(dy, dx);

      var edgeStartX = x1 + Math.cos(angle) * (fromNode.w / 2);
      var edgeStartY = y1 + Math.sin(angle) * (fromNode.h / 2);
      var edgeEndX = x2 - Math.cos(angle) * (toNode.w / 2);
      var edgeEndY = y2 - Math.sin(angle) * (toNode.h / 2);

      items.push({
        type: 'edge',
        from: edge.from,
        to: edge.to,
        label: edge.label || '',
        x1: edgeStartX,
        y1: edgeStartY,
        x2: edgeEndX,
        y2: edgeEndY,
        arrow: edge.arrow !== false,
        color: edge.color || '#64748b',
        sentenceIndex: edge.sentenceIndex
      });
    }

    // Notes
    for (var m = 0; m < notes.length; m++) {
      var note = notes[m];
      var noteX = typeof note.x === 'number' ? note.x : (canvasW / 2);
      var noteY = typeof note.y === 'number' ? note.y : (canvasH - 35 - m * 28);
      items.push({
        type: 'note',
        text: note.text || '',
        x: noteX,
        y: noteY,
        color: note.color || '#4f46e5',
        fontSize: note.fontSize || 20,
        sentenceIndex: note.sentenceIndex
      });
    }

    return items;
  }

  // ─── Animation Sequence Builder ───────────────────────────────────────────

  function buildAnimationSteps(items, canvasW, canvasH, styleOpts, rng) {
    styleOpts = styleOpts || resolveStyle({});
    rng = rng || createRng(styleOpts.seed);

    var steps = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (item.type === 'heading' || item.type === 'subheading') {
        (function(it) {
          steps.push({
            id: it.type + '_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              ctx.save();
              ctx.font = (it.type === 'heading' ? '700 ' : '600 ') + it.fontSize + 'px "Outfit", "Inter", sans-serif';
              ctx.fillStyle = it.color;
              var isLeft = it.align === 'left';
              ctx.textAlign = isLeft ? 'left' : 'center';
              ctx.textBaseline = 'middle';
              var chars = Math.max(1, Math.floor(t * it.text.length));
              var revealed = it.text.substring(0, chars);
              var drawX = isLeft ? it.x : (canvasW / 2);
              ctx.fillText(revealed, drawX, it.y);

              var w = ctx.measureText(revealed).width;
              var tipX = isLeft ? (drawX + w) : (drawX + w / 2);
              ctx.restore();
              return { x: tipX, y: it.y };
            }
          });
        })(item);
      } else if (item.type === 'underline') {
        (function(it) {
          var uOpts = Object.assign({}, styleOpts, {
            bowing: styleOpts.bowing * 0.7,
            roughness: styleOpts.roughness * 0.65
          });
          var pts = generateHandDrawnLine(it.x1, it.y, it.x2, it.y, uOpts, rng);

          steps.push({
            id: 'underline_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              return drawPointPath(ctx, pts, t, it.color || '#2563eb', it.width || 3);
            }
          });
        })(item);
      } else if (item.type === 'node') {
        (function(it) {
          var isRhombus = (it.shape === 'rhombus' || it.shape === 'diamond');
          var isRound = (it.shape === 'ellipse' || it.shape === 'circle' || it.shape === 'round');

          var pts = null;
          var pts2 = null;

          if (isRound) {
            pts = generateHandDrawnEllipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, styleOpts, rng);
            if (styleOpts.doubleStroke) {
              pts2 = generateHandDrawnEllipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, styleOpts, rng);
            }
          } else if (isRhombus) {
            pts = generateHandDrawnRhombus(it.x, it.y, it.w, it.h, styleOpts, rng);
            if (styleOpts.doubleStroke) {
              pts2 = generateHandDrawnRhombus(it.x, it.y, it.w, it.h, styleOpts, rng);
            }
          } else {
            pts = generateHandDrawnRect(it.x, it.y, it.w, it.h, styleOpts, rng);
            if (styleOpts.doubleStroke) {
              pts2 = generateHandDrawnRect(it.x, it.y, it.w, it.h, styleOpts, rng);
            }
          }

          steps.push({
            id: it.id,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              ctx.save();
              var tip = null;

              // Phase 1: Draw shape outline (0% to 45%)
              var shapeT = Math.min(1, t / 0.45);
              if (shapeT > 0 && pts && pts.length >= 2) {
                // Background fill
                if (it.fill && shapeT >= 0.85) {
                  ctx.fillStyle = it.fill;
                  ctx.beginPath();
                  ctx.moveTo(pts[0].x, pts[0].y);
                  for (var fIdx = 1; fIdx < pts.length; fIdx++) {
                    ctx.lineTo(pts[fIdx].x, pts[fIdx].y);
                  }
                  ctx.closePath();
                  ctx.fill();
                }

                // Primary organic stroke
                tip = drawPointPath(ctx, pts, shapeT, it.color || '#2563eb', 2);

                // Sketchy double stroke
                if (pts2 && shapeT >= 0.25) {
                  var t2 = (shapeT - 0.25) / 0.75;
                  ctx.save();
                  ctx.globalAlpha = 0.5;
                  drawPointPath(ctx, pts2, t2, it.color || '#2563eb', 1.4);
                  ctx.restore();
                }
              }

              // Phase 2: Draw label text inside node (45% to 100%) - Text and code remain crisp & readable
              var linesToDraw = (it.lines && it.lines.length > 0) ? it.lines : [it.label || ''];
              if (t > 0.40 && linesToDraw.length > 0 && linesToDraw[0]) {
                var textT = Math.min(1, (t - 0.40) / 0.60);
                var midX = it.x + it.w / 2;
                var midY = it.y + it.h / 2;

                var safeW = isRhombus ? (it.w * 0.60) : (isRound ? (it.w * 0.74) : (it.w - 20));
                var safeH = isRhombus ? (it.h * 0.55) : (isRound ? (it.h * 0.70) : (it.h - 16));

                var isCode = isCodeSnippet(it.label);
                var fontFam = isCode
                  ? '"Fira Code", "Cascadia Code", "JetBrains Mono", "Consolas", monospace'
                  : '"Outfit", "Inter", sans-serif';

                var baseFontSize = linesToDraw.length > 1 ? 17 : 20;
                var fs = baseFontSize;

                for (var attempt = 0; attempt < 8; attempt++) {
                  ctx.font = (isCode ? '500 ' : '600 ') + fs + 'px ' + fontFam;
                  var maxLineWidth = 0;
                  for (var L = 0; L < linesToDraw.length; L++) {
                    var lineW = ctx.measureText(linesToDraw[L]).width;
                    if (lineW > maxLineWidth) maxLineWidth = lineW;
                  }
                  var totalTextH = linesToDraw.length * (fs * 1.25);
                  if (maxLineWidth <= safeW && totalTextH <= safeH) break;
                  var scale = Math.min(safeW / Math.max(1, maxLineWidth), safeH / Math.max(1, totalTextH));
                  fs = Math.max(11, Math.floor(fs * Math.min(0.92, scale)));
                }

                var lineHeight = Math.round(fs * 1.26);
                var totalBlockH = (linesToDraw.length - 1) * lineHeight;
                var startY = midY - (totalBlockH / 2);

                ctx.font = (isCode ? '500 ' : '600 ') + fs + 'px ' + fontFam;
                ctx.fillStyle = isCode ? '#1e293b' : (it.color || '#0f172a');
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                var totalChars = 0;
                for (var cIdx = 0; cIdx < linesToDraw.length; cIdx++) {
                  totalChars += linesToDraw[cIdx].length;
                }
                var charsToReveal = Math.max(1, Math.floor(textT * totalChars));
                var charsRemaining = charsToReveal;

                var activeTextTip = null;
                for (var lineIdx = 0; lineIdx < linesToDraw.length; lineIdx++) {
                  var lineStr = linesToDraw[lineIdx];
                  var lineY = startY + lineIdx * lineHeight;
                  if (charsRemaining > 0) {
                    var curLineChars = Math.min(lineStr.length, charsRemaining);
                    var sub = lineStr.substring(0, curLineChars);
                    ctx.fillText(sub, midX, lineY);
                    var wPartial = ctx.measureText(sub).width;
                    activeTextTip = { x: midX + wPartial / 2, y: lineY };
                    charsRemaining -= curLineChars;
                  }
                }
                if (activeTextTip) tip = activeTextTip;
              }

              ctx.restore();
              return tip;
            }
          });
        })(item);
      } else if (item.type === 'edge') {
        (function(it) {
          var eOpts = Object.assign({}, styleOpts, {
            bowing: styleOpts.bowing * 0.7,
            roughness: styleOpts.roughness * 0.75
          });
          var shaftPts = generateHandDrawnLine(it.x1, it.y1, it.x2, it.y2, eOpts, rng);

          steps.push({
            id: 'edge_' + it.from + '_' + it.to,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              ctx.save();
              var lineT = Math.min(1, t / 0.88);
              var tip = drawPointPath(ctx, shaftPts, lineT, it.color || '#64748b', 2);

              // Arrowhead
              if (it.arrow && t >= 0.88) {
                var arrowProgress = Math.min(1, (t - 0.88) / 0.12);
                var pEnd = shaftPts[shaftPts.length - 1];
                var pPrev = shaftPts[Math.max(0, shaftPts.length - 3)];
                drawArrowhead(ctx, pPrev.x, pPrev.y, pEnd.x, pEnd.y, 12 * arrowProgress, it.color || '#64748b');
              }

              // Edge label
              if (it.label && t >= 0.65) {
                var lblT = Math.min(1, (t - 0.65) / 0.35);
                var midIdx = Math.floor(shaftPts.length / 2);
                var labelX = shaftPts[midIdx].x;
                var labelY = shaftPts[midIdx].y - 12;
                ctx.font = '500 15px "Outfit", "Inter", sans-serif';
                ctx.fillStyle = it.color || '#64748b';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var showChars = Math.max(1, Math.floor(lblT * it.label.length));
                ctx.fillText(it.label.substring(0, showChars), labelX, labelY);
              }

              ctx.restore();
              return tip;
            }
          });
        })(item);
      } else if (item.type === 'note') {
        (function(it) {
          steps.push({
            id: 'note_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              ctx.save();
              ctx.font = '500 ' + it.fontSize + 'px "Outfit", "Inter", sans-serif';
              ctx.fillStyle = it.color;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              var chars = Math.max(1, Math.floor(t * it.text.length));
              var sub = it.text.substring(0, chars);
              ctx.fillText(sub, it.x, it.y);
              var w = ctx.measureText(sub).width;
              ctx.restore();
              return { x: it.x + w / 2, y: it.y };
            }
          });
        })(item);
      } else if (item.type === 'rect') {
        (function(it) {
          var pts = generateHandDrawnRect(it.x, it.y, it.w, it.h, styleOpts, rng);
          steps.push({
            id: it.id || 'rect_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              if (it.fill && t >= 0.85) {
                ctx.save();
                ctx.fillStyle = it.fill;
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (var f = 1; f < pts.length; f++) ctx.lineTo(pts[f].x, pts[f].y);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }
              return drawPointPath(ctx, pts, t, it.color || '#2563eb', it.width || 2);
            }
          });
        })(item);
      } else if (item.type === 'text') {
        (function(it) {
          steps.push({
            id: it.id || 'text_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              ctx.save();
              var fs = it.fontSize || 24;
              ctx.font = (it.fontWeight || '600') + ' ' + fs + 'px "Outfit", "Inter", sans-serif';
              ctx.fillStyle = it.color || '#0f172a';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              var c = Math.max(1, Math.floor(t * (it.text || '').length));
              var sub = (it.text || '').substring(0, c);
              ctx.fillText(sub, it.x, it.y);
              var w = ctx.measureText(sub).width;
              ctx.restore();
              return { x: it.x + w / 2, y: it.y };
            }
          });
        })(item);
      } else if (item.type === 'arrow' || item.type === 'line') {
        (function(it) {
          var pts = generateHandDrawnLine(it.x1, it.y1, it.x2, it.y2, styleOpts, rng);
          steps.push({
            id: it.id || 'line_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              var tip = drawPointPath(ctx, pts, t, it.color || '#2563eb', it.width || 2);
              if (it.type === 'arrow' && t >= 0.88) {
                var pEnd = pts[pts.length - 1];
                var pPrev = pts[Math.max(0, pts.length - 3)];
                drawArrowhead(ctx, pPrev.x, pPrev.y, pEnd.x, pEnd.y, 12, it.color || '#2563eb');
              }
              return tip;
            }
          });
        })(item);
      } else if (item.type === 'ellipse') {
        (function(it) {
          var pts = generateHandDrawnEllipse(it.cx, it.cy, it.rx, it.ry, styleOpts, rng);
          steps.push({
            id: it.id || 'ellipse_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              return drawPointPath(ctx, pts, t, it.color || '#94a3b8', it.width || 1.5);
            }
          });
        })(item);
      } else if (item.type === 'path') {
        (function(it) {
          var pts = generateHandDrawnPath(it.points, styleOpts, rng);
          steps.push({
            id: it.id || 'path_' + i,
            sentenceIndex: it.sentenceIndex,
            draw: function(ctx, t) {
              return drawPointPath(ctx, pts, t, it.color || '#ef4444', it.width || 3);
            }
          });
        })(item);
      }
    }

    // Allocate timeline slices (10% to 92% across slide progress)
    var stepCount = steps.length;
    var animStart = 0.10;
    var animEnd = 0.92;
    var animDuration = animEnd - animStart;
    var sliceSize = stepCount > 0 ? animDuration / stepCount : 1;

    for (var s = 0; s < stepCount; s++) {
      steps[s].startProgress = animStart + s * sliceSize;
      steps[s].endProgress = steps[s].startProgress + sliceSize;
    }

    return steps;
  }

  // ─── Public Board Engine Interface ────────────────────────────────────────

  var _canvas = null;
  var _ctx = null;
  var _steps = [];
  var _width = 0;
  var _height = 0;
  var _boardData = null;
  var _styleOpts = null;

  var Board = {
    /**
     * Load a board data object into the whiteboard canvas.
     * @param {Object} boardData - Board specification
     * @param {number} width - Canvas width in pixels
     * @param {number} height - Canvas height in pixels
     * @param {Object} [opts] - Additional options (e.g. slideHeading)
     */
    load: function(boardData, width, height, opts) {
      _canvas = document.getElementById('board-canvas');
      if (!_canvas) return;

      _width = width || _canvas.clientWidth || 1280;
      _height = height || _canvas.clientHeight || 720;
      _canvas.width = _width;
      _canvas.height = _height;
      _ctx = _canvas.getContext('2d');

      _boardData = boardData;
      _styleOpts = resolveStyle(boardData);
      var rng = createRng(_styleOpts.seed);
      var items = compileBoardLayout(boardData, _width, _height, opts);
      _steps = buildAnimationSteps(items, _width, _height, _styleOpts, rng);

      // Initial clear
      _ctx.clearRect(0, 0, _width, _height);
    },

    /**
     * Render the board state for the current progress point.
     * @param {number} elapsedSecs - Elapsed seconds into the slide
     * @param {number} totalDuration - Total slide duration in seconds
     */
    render: function(elapsedSecs, totalDuration) {
      if (!_ctx || !_canvas || _steps.length === 0) return;

      var progress = totalDuration > 0 ? Math.min(1, Math.max(0, elapsedSecs / totalDuration)) : 1;

      // Transparent background over white
      _ctx.clearRect(0, 0, _width, _height);

      var activeTip = null;

      for (var i = 0; i < _steps.length; i++) {
        var step = _steps[i];
        if (progress >= step.endProgress) {
          step.draw(_ctx, 1.0);
        } else if (progress > step.startProgress) {
          var t = (progress - step.startProgress) / (step.endProgress - step.startProgress);
          var tip = step.draw(_ctx, Math.min(1, Math.max(0, t)));
          if (tip && typeof tip.x === 'number') {
            activeTip = tip;
          }
        }
      }

      // Draw the digital pen tip cursor following the active drawing coordinate (fades out when diagram completes)
      if (_boardData && _boardData.showCursor !== false && activeTip && progress < 0.88) {
        drawPenCursor(_ctx, activeTip.x, activeTip.y);
      }
    },

    /**
     * Get compiled steps count for testing.
     */
    getStepCount: function() {
      return _steps.length;
    },

    /**
     * Get current style configuration.
     */
    getStyle: function() {
      return _styleOpts;
    },

    // Exposed geometry functions & presets for testing and custom usage
    DRAWING_PRESETS: DRAWING_PRESETS,
    resolveStyle: resolveStyle,
    createRng: createRng,
    hashString: hashString,
    geometry: {
      line: generateHandDrawnLine,
      rect: generateHandDrawnRect,
      ellipse: generateHandDrawnEllipse,
      rhombus: generateHandDrawnRhombus,
      arrow: generateHandDrawnLine,
      path: generateHandDrawnPath,
      drawPointPath: drawPointPath
    }
  };

  if (typeof window !== 'undefined') {
    window.Board = Board;
    window.HandDrawnGeometry = Board.geometry;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      Board: Board,
      DRAWING_PRESETS: DRAWING_PRESETS,
      resolveStyle: resolveStyle,
      createRng: createRng,
      hashString: hashString,
      generateHandDrawnLine: generateHandDrawnLine,
      generateHandDrawnRect: generateHandDrawnRect,
      generateHandDrawnEllipse: generateHandDrawnEllipse,
      generateHandDrawnRhombus: generateHandDrawnRhombus,
      generateHandDrawnPath: generateHandDrawnPath,
      drawPointPath: drawPointPath,
      compileBoardLayout: compileBoardLayout,
      buildAnimationSteps: buildAnimationSteps
    };
  }
})();


