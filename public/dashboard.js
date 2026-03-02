(function initDashboardModule() {
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const PALETTE = ['#0abde3', '#8e44ad', '#f66b0e', '#2ecc71', '#e63946', '#f9ca24'];

  const BASE_OPTS = {
    chart: {
      background: 'transparent',
      foreColor: '#a0aab2',
      toolbar: { show: false },
      animations: { enabled: true, speed: 600 },
      fontFamily: 'Inter, sans-serif',
    },
    theme: { mode: 'dark' },
    grid: { borderColor: 'rgba(255,255,255,0.07)' },
    tooltip: { theme: 'dark' },
  };

  function mergeOpts(...layers) {
    return layers.reduce((acc, layer) => {
      const result = { ...acc };
      for (const key of Object.keys(layer)) {
        if (
          result[key] !== null &&
          typeof result[key] === 'object' &&
          !Array.isArray(result[key]) &&
          typeof layer[key] === 'object' &&
          !Array.isArray(layer[key])
        ) {
          result[key] = mergeOpts(result[key], layer[key]);
        } else {
          result[key] = layer[key];
        }
      }
      return result;
    }, {});
  }

  function createDashboard() {
    const charts = {};

    function destroyChart(id) {
      if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
      }
    }

    function renderChart(id, options) {
      destroyChart(id);
      const el = document.getElementById(id);
      if (!el) return;
      const instance = new ApexCharts(el, mergeOpts(BASE_OPTS, options));
      instance.render();
      charts[id] = instance;
    }

    // -------------------------------------------------------------------
    // Engagement — RadialBar gauge with 4 components
    // -------------------------------------------------------------------
    function renderEngagement(data) {
      const c = data.engagement.components;
      const score = Math.round(data.engagement.score * 100);
      const values = [
        Math.round(c.frequency * 100),
        Math.round(c.duration * 100),
        Math.round(c.streak * 100),
        Math.round(c.consistency * 100),
      ];
      renderChart('dash-engagement', {
        chart: { type: 'radialBar', height: 240 },
        series: values,
        labels: ['Frequency', 'Duration', 'Streak', 'Consistency'],
        colors: ['#0abde3', '#8e44ad', '#f66b0e', '#2ecc71'],
        plotOptions: {
          radialBar: {
            hollow: { size: '25%' },
            track: { background: 'rgba(255,255,255,0.05)' },
            dataLabels: {
              name: { fontSize: '11px' },
              value: { fontSize: '13px', formatter: (v) => `${v}%` },
              total: {
                show: true,
                label: 'Score',
                formatter: () => `${score}%`,
                color: '#f8f9fa',
                fontSize: '16px',
                fontWeight: 700,
              },
            },
          },
        },
        stroke: { lineCap: 'round' },
      });
    }

    // -------------------------------------------------------------------
    // Topic Mastery — Horizontal bar with gradient fill
    // -------------------------------------------------------------------
    function renderTopicMastery(data) {
      const sorted = [...data.topic_mastery].sort((a, b) => b.p_mastery - a.p_mastery);
      renderChart('dash-topic-mastery', {
        chart: { type: 'bar', height: 240 },
        series: [{ name: 'Mastery', data: sorted.map((r) => Math.round(r.p_mastery * 100)) }],
        xaxis: { categories: sorted.map((r) => r.concept_tag), max: 100 },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 4,
            dataLabels: { position: 'top' },
          },
        },
        dataLabels: { enabled: true, formatter: (v) => `${v}%`, offsetX: 30, style: { fontSize: '11px' } },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            type: 'horizontal',
            gradientToColors: ['#8e44ad'],
            stops: [0, 100],
          },
        },
        colors: ['#0abde3'],
        yaxis: { labels: { style: { fontSize: '11px' } } },
      });
    }

    // -------------------------------------------------------------------
    // Error Pattern Heatmap
    // -------------------------------------------------------------------
    function renderErrorHeatmap(data) {
      const concepts = data.error_heatmap.concepts;
      const labels = data.error_heatmap.error_labels;

      // Build series: one series per error label, data = count per concept
      const series = labels.map((label) => {
        const row = concepts.map((concept) => {
          const cell = data.error_heatmap.cells.find(
            (c) => c.concept_tag === concept && c.error_classification === label
          );
          return cell ? cell.count : 0;
        });
        return { name: label, data: row };
      });

      renderChart('dash-error-heatmap', {
        chart: { type: 'heatmap', height: 240 },
        series,
        xaxis: { categories: concepts },
        colors: ['#e63946'],
        dataLabels: { enabled: false },
        plotOptions: {
          heatmap: {
            shadeIntensity: 0.7,
            radius: 4,
            colorScale: {
              ranges: [
                { from: 0, to: 0, color: 'rgba(255,255,255,0.03)', name: 'None' },
                { from: 1, to: 2, color: '#f9ca2455', name: 'Low' },
                { from: 3, to: 5, color: '#f66b0e99', name: 'Medium' },
                { from: 6, to: 999, color: '#e63946cc', name: 'High' },
              ],
            },
          },
        },
      });
    }

    // -------------------------------------------------------------------
    // Learning Velocity — Radial gauge (single bar)
    // -------------------------------------------------------------------
    function renderVelocity(data) {
      const raw = data.learning_velocity.velocity_per_hour;
      const display = parseFloat(raw.toFixed(4));
      // Map to 0–100 for gauge: clamp and scale
      const pct = Math.round(Math.max(0, Math.min(1, raw * 30 + 0.5)) * 100);
      renderChart('dash-velocity', {
        chart: { type: 'radialBar', height: 240 },
        series: [pct],
        colors: ['#f4a261'],
        plotOptions: {
          radialBar: {
            hollow: { size: '55%' },
            track: { background: 'rgba(255,255,255,0.05)' },
            dataLabels: {
              name: { show: true, label: 'Velocity/hr', color: '#a0aab2', fontSize: '11px', offsetY: 20 },
              value: {
                show: true,
                formatter: () => display.toString(),
                color: '#f8f9fa',
                fontSize: '18px',
                fontWeight: 700,
                offsetY: -10,
              },
            },
            startAngle: -135,
            endAngle: 135,
          },
        },
        stroke: { lineCap: 'round' },
        labels: ['Velocity/hr'],
      });
    }

    // -------------------------------------------------------------------
    // Mastery Over Time — Area chart per concept
    // -------------------------------------------------------------------
    function renderMastery(data) {
      const points = data.mastery_timeline;
      const grouped = new Map();
      points.forEach((p) => {
        if (!grouped.has(p.concept_tag)) grouped.set(p.concept_tag, []);
        grouped.get(p.concept_tag).push(p);
      });

      const series = [];
      let colorIdx = 0;
      grouped.forEach((rows, concept) => {
        rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        series.push({
          name: concept,
          data: rows.map((r) => ({ x: new Date(r.timestamp).getTime(), y: parseFloat(r.p_mastery.toFixed(3)) })),
          color: PALETTE[colorIdx % PALETTE.length],
        });
        colorIdx++;
      });

      renderChart('dash-mastery', {
        chart: { type: 'area', height: 240 },
        series,
        xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
        yaxis: { min: 0, max: 1, labels: { formatter: (v) => v.toFixed(1) } },
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
        dataLabels: { enabled: false },
        legend: { show: true },
      });
    }

    // -------------------------------------------------------------------
    // Forgetting Curve Projection — Dashed lines per concept
    // -------------------------------------------------------------------
    function renderForgetting(data) {
      const series = data.forgetting_curves.projections.map((proj, idx) => ({
        name: proj.concept_tag,
        data: proj.points.map((p) => ({ x: p.days, y: parseFloat(p.projected_mastery.toFixed(3)) })),
        color: PALETTE[idx % PALETTE.length],
      }));

      renderChart('dash-forgetting', {
        chart: { type: 'line', height: 240 },
        series,
        xaxis: { title: { text: 'Days from now', style: { color: '#a0aab2' } } },
        yaxis: { min: 0, max: 1, labels: { formatter: (v) => v.toFixed(1) } },
        stroke: { curve: 'smooth', width: 2, dashArray: 5 },
        dataLabels: { enabled: false },
        legend: { show: true },
      });
    }

    // -------------------------------------------------------------------
    // Spaced Repetition — Horizontal bar (hours until review)
    // -------------------------------------------------------------------
    function renderSpacedRepetition(data) {
      const recs = data.review_schedule.recommendations;
      if (recs.length === 0) {
        const el = document.getElementById('dash-spaced-repetition');
        if (el) el.innerHTML = '<p style="padding:1rem;color:#a0aab2">No concepts scheduled for review yet.</p>';
        return;
      }

      const sorted = [...recs].sort((a, b) => a.hours_until_review - b.hours_until_review);
      renderChart('dash-spaced-repetition', {
        chart: { type: 'bar', height: 240 },
        series: [{ name: 'Hours until review', data: sorted.map((r) => parseFloat(r.hours_until_review.toFixed(1))) }],
        xaxis: { categories: sorted.map((r) => r.concept_tag) },
        plotOptions: {
          bar: {
            horizontal: true,
            borderRadius: 4,
          },
        },
        colors: ['#2ecc71'],
        dataLabels: { enabled: true, formatter: (v) => `${v}h`, style: { fontSize: '11px' } },
        yaxis: { labels: { style: { fontSize: '11px' } } },
      });
    }

    // -------------------------------------------------------------------
    // EMA Momentum Trend — Area chart per concept
    // -------------------------------------------------------------------
    function renderEMA(data) {
      const points = data.ema_timeline;
      const grouped = new Map();
      points.forEach((p) => {
        if (!grouped.has(p.concept_tag)) grouped.set(p.concept_tag, []);
        grouped.get(p.concept_tag).push(p);
      });

      const series = [];
      let colorIdx = 0;
      grouped.forEach((rows, concept) => {
        rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        series.push({
          name: concept,
          data: rows.map((r) => ({ x: new Date(r.timestamp).getTime(), y: parseFloat(r.ema.toFixed(3)) })),
          color: PALETTE[colorIdx % PALETTE.length],
        });
        colorIdx++;
      });

      renderChart('dash-ema', {
        chart: { type: 'area', height: 240 },
        series,
        xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
        yaxis: { min: 0, max: 1, labels: { formatter: (v) => v.toFixed(1) } },
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
        dataLabels: { enabled: false },
        legend: { show: true },
      });
    }

    // -------------------------------------------------------------------
    // Cumulative Accuracy — Area chart
    // -------------------------------------------------------------------
    function renderCumulativeAccuracy(data) {
      const points = data.cumulative_accuracy;
      renderChart('dash-cumulative-accuracy', {
        chart: { type: 'area', height: 240 },
        series: [{
          name: 'Cumulative Accuracy',
          data: points.map((p) => ({ x: new Date(p.timestamp).getTime(), y: parseFloat(p.cumulative_accuracy.toFixed(3)) })),
        }],
        xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
        yaxis: { min: 0, max: 1, labels: { formatter: (v) => `${Math.round(v * 100)}%` } },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'dark',
            gradientToColors: ['#8e44ad'],
            opacityFrom: 0.45,
            opacityTo: 0.05,
          },
        },
        colors: ['#0abde3'],
        dataLabels: { enabled: false },
      });
    }

    // -------------------------------------------------------------------
    // Weekly Activity Heatmap — day × hour heatmap
    // -------------------------------------------------------------------
    function renderWeeklyActivity(data) {
      // Build 7 series (one per day), each with 24 data points (hours)
      const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
      data.weekly_activity_heatmap.forEach((cell) => {
        const d = Math.min(6, Math.max(0, cell.day_of_week));
        const h = Math.min(23, Math.max(0, cell.hour_of_day));
        grid[d][h] = cell.count;
      });

      const series = DAY_LABELS.map((day, d) => ({
        name: day,
        data: grid[d].map((count, h) => ({ x: `${h}:00`, y: count })),
      }));

      renderChart('dash-weekly-activity', {
        chart: { type: 'heatmap', height: 240 },
        series,
        colors: ['#0abde3'],
        dataLabels: { enabled: false },
        plotOptions: {
          heatmap: {
            shadeIntensity: 0.8,
            radius: 3,
            colorScale: {
              ranges: [
                { from: 0, to: 0, color: 'rgba(255,255,255,0.03)', name: 'Inactive' },
                { from: 1, to: 2, color: '#0abde355', name: 'Low' },
                { from: 3, to: 5, color: '#0abde3aa', name: 'Medium' },
                { from: 6, to: 999, color: '#0abde3', name: 'High' },
              ],
            },
          },
        },
        xaxis: { title: { text: 'Hour (UTC)', style: { color: '#a0aab2' } } },
      });
    }

    // -------------------------------------------------------------------
    // KPI stat cards (summary_kpis from analytics payload)
    // -------------------------------------------------------------------
    function renderKPIs(data) {
      if (!data.summary_kpis) return;
      const kpis = data.summary_kpis;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('kpi-total-attempts', kpis.total_attempts.toLocaleString());
      set('kpi-overall-accuracy', `${Math.round(kpis.overall_accuracy * 100)}%`);
      set('kpi-current-streak', kpis.current_streak);
      set('kpi-best-streak', kpis.best_streak);
      set('kpi-concepts-attempted', kpis.concepts_attempted);
      set('kpi-concepts-mastered', kpis.concepts_mastered);
    }

    // -------------------------------------------------------------------
    // Render all charts
    // -------------------------------------------------------------------
    function renderAll(data) {
      renderKPIs(data);
      renderEngagement(data);
      renderTopicMastery(data);
      renderErrorHeatmap(data);
      renderVelocity(data);
      renderMastery(data);
      renderForgetting(data);
      renderSpacedRepetition(data);
      renderEMA(data);
      renderCumulativeAccuracy(data);
      renderWeeklyActivity(data);
    }

    async function load(studentId) {
      const status = document.getElementById('analytics-status');
      if (status) status.textContent = `Loading analytics for ${studentId}...`;

      const response = await fetch(`/api/v1/analytics/${encodeURIComponent(studentId)}/dashboard`);
      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }

      const data = await response.json();
      renderAll(data);
      if (status) status.textContent = `Analytics loaded for ${studentId}`;
    }

    return {
      load,
      destroy() {
        Object.keys(charts).forEach((id) => destroyChart(id));
      },
    };
  }

  window.EduRotDashboard = { createDashboard };
})();
