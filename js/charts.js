// ═══════════════════════════════════════════════
//  FINANCIAL TRACKER — Charts v3
// ═══════════════════════════════════════════════

const Charts = (() => {
  let _pie = null, _bar = null, _investLine = null;

  Chart.defaults.color = '#6b6b8a';
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  const TOOLTIP_STYLE = {
    backgroundColor: '#1a1a24', borderColor: '#2a2a3a', borderWidth: 1,
    titleColor: '#f0f0f8', bodyColor: '#a0a0c0', padding: 10, cornerRadius: 8,
  };

  function renderPie(transactions) {
    const canvas = document.getElementById('pie-chart');
    const empty  = document.getElementById('chart-empty');
    const legend = document.getElementById('pie-legend');
    if (!canvas) return;

    const uscite = transactions.filter(t => t.type === 'Uscita');
    if (uscite.length === 0) {
      canvas.classList.add('hidden'); empty.classList.remove('hidden');
      legend.innerHTML = ''; if (_pie) { _pie.destroy(); _pie = null; } return;
    }
    canvas.classList.remove('hidden'); empty.classList.add('hidden');

    const totals = {};
    uscite.forEach(t => { totals[t.category] = (totals[t.category]||0) + t.amount; });
    const sorted = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
    const labels = sorted.map(e=>e[0]), data = sorted.map(e=>e[1]);
    const colors = labels.map(l=>getCategoryColor(l));

    if (_pie) _pie.destroy();
    _pie = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#1a1a24', hoverOffset: 8 }] },
      options: {
        responsive: true, cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${formatEuro(ctx.parsed)}` }, ...TOOLTIP_STYLE }
        }
      }
    });

    const total = data.reduce((s,v)=>s+v,0);
    legend.innerHTML = sorted.slice(0,8).map(([name,val])=>`
      <div class="legend-item">
        <div class="legend-dot" style="background:${getCategoryColor(name)}"></div>
        <span>${getCategoryIcon(name)} ${pct(val,total)}%</span>
      </div>`).join('');
  }

  function renderBar(annualData) {
    const canvas = document.getElementById('bar-chart');
    if (!canvas) return;
    if (_bar) _bar.destroy();
    _bar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: MONTHS.map(m=>m.slice(0,3)),
        datasets: [
          { label:'Entrate', data: annualData.map(d=>d.entrate), backgroundColor:'rgba(52,211,153,.7)', borderRadius:4, borderSkipped:false },
          { label:'Uscite',  data: annualData.map(d=>d.uscite),  backgroundColor:'rgba(248,113,113,.7)', borderRadius:4, borderSkipped:false },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position:'top', labels:{ boxWidth:10, boxHeight:10, usePointStyle:true, pointStyle:'rectRounded', font:{size:11} } },
          tooltip: { callbacks:{ label: ctx=>` ${formatEuro(ctx.parsed.y)}` }, ...TOOLTIP_STYLE }
        },
        scales: {
          x: { grid:{display:false}, border:{display:false}, ticks:{font:{size:10}} },
          y: { grid:{color:'rgba(42,42,58,.6)',drawTicks:false}, border:{display:false,dash:[4,4]}, ticks:{ font:{size:10}, callback: v=>v>=1000?`€${(v/1000).toFixed(0)}k`:`€${v}` } }
        }
      }
    });
  }

  function renderInvestmentLine(deposits, planName) {
    const canvas = document.getElementById('invest-line-chart');
    if (!canvas) return;
    if (_investLine) _investLine.destroy();
    if (!deposits.length) return;

    const sorted = [...deposits].sort((a,b)=>a.date.localeCompare(b.date));
    let cumulative = 0;
    const points = sorted.map(d => { cumulative += d.amount; return { x: d.date, y: cumulative }; });

    _investLine = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map(p => formatDate(p.x)),
        datasets: [{
          label: 'Capitale investito',
          data: points.map(p => p.y),
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167,139,250,.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#a78bfa',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks:{ label: ctx=>` ${formatEuro(ctx.parsed.y)}` }, ...TOOLTIP_STYLE }
        },
        scales: {
          x: { grid:{display:false}, border:{display:false}, ticks:{font:{size:10}, maxTicksLimit:6} },
          y: { grid:{color:'rgba(42,42,58,.6)'}, border:{display:false}, ticks:{ font:{size:10}, callback: v=>`€${(v/1000).toFixed(0)}k` } }
        }
      }
    });
  }

  function renderInvestmentPie(investments) {
    const canvas = document.getElementById('invest-pie-chart');
    if (!canvas) return;

    const active = investments.filter(i => i.active && i.current > 0);
    if (!active.length) return;

    const COLORS = ['#6366f1','#34d399','#f59e0b','#f43f5e','#06b6d4','#a78bfa','#84cc16','#ec4899'];

    if (window._investPie) window._investPie.destroy();
    window._investPie = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: active.map(i => i.name),
        datasets: [{
          data: active.map(i => i.current),
          backgroundColor: active.map((_,i) => COLORS[i % COLORS.length]),
          borderWidth: 2, borderColor: '#1a1a24', hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks:{ label: ctx=>` ${formatEuro(ctx.parsed)}` }, ...TOOLTIP_STYLE }
        }
      }
    });
  }

  return { renderPie, renderBar, renderInvestmentLine, renderInvestmentPie };
})();
