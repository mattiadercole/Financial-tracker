// ═══════════════════════════════════════════════
//  SOSOLDI — Charts
// ═══════════════════════════════════════════════

const Charts = (() => {
  let _pieChart = null;
  let _barChart = null;

  const PIE_COLORS = CATEGORIES_EXP.map(c => c.color);

  Chart.defaults.color = '#6b6b8a';
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  function renderPie(transactions) {
    const canvas = document.getElementById('pie-chart');
    const empty  = document.getElementById('chart-empty');
    const legend = document.getElementById('pie-legend');

    const uscite = transactions.filter(t => t.type === 'Uscita');

    if (uscite.length === 0) {
      canvas.classList.add('hidden');
      empty.classList.remove('hidden');
      legend.innerHTML = '';
      if (_pieChart) { _pieChart.destroy(); _pieChart = null; }
      return;
    }

    canvas.classList.remove('hidden');
    empty.classList.add('hidden');

    // Aggregate by category
    const totals = {};
    uscite.forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

    const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1]);
    const labels = sorted.map(e => e[0]);
    const data   = sorted.map(e => e[1]);
    const colors = labels.map(l => getCategoryColor(l));

    if (_pieChart) _pieChart.destroy();

    _pieChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#1a1a24',
          hoverBorderColor: '#1a1a24',
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatEuro(ctx.parsed)}`
            },
            backgroundColor: '#1a1a24',
            borderColor: '#2a2a3a',
            borderWidth: 1,
            titleColor: '#f0f0f8',
            bodyColor: '#a0a0c0',
            padding: 10,
            cornerRadius: 8,
          }
        }
      }
    });

    // Legend
    const total = data.reduce((s,v) => s+v, 0);
    legend.innerHTML = sorted.slice(0, 8).map(([name, val]) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${getCategoryColor(name)}"></div>
        <span>${getCategoryIcon(name)} ${(val/total*100).toFixed(0)}%</span>
      </div>
    `).join('');
  }

  function renderBar(annualData) {
    const canvas = document.getElementById('bar-chart');
    if (!canvas) return;

    const labels   = MONTHS.map(m => m.slice(0,3));
    const entrate  = annualData.map(d => d.entrate);
    const uscite   = annualData.map(d => d.uscite);

    if (_barChart) _barChart.destroy();

    _barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Entrate',
            data: entrate,
            backgroundColor: 'rgba(52,211,153,.7)',
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: 'Uscite',
            data: uscite,
            backgroundColor: 'rgba(248,113,113,.7)',
            borderRadius: 4,
            borderSkipped: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              borderRadius: 3,
              usePointStyle: true,
              pointStyle: 'rectRounded',
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatEuro(ctx.parsed.y)}`
            },
            backgroundColor: '#1a1a24',
            borderColor: '#2a2a3a',
            borderWidth: 1,
            titleColor: '#f0f0f8',
            bodyColor: '#a0a0c0',
            padding: 10,
            cornerRadius: 8,
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 10 } }
          },
          y: {
            grid: { color: 'rgba(42,42,58,.6)', drawTicks: false },
            border: { display: false, dash: [4,4] },
            ticks: {
              font: { size: 10 },
              callback: v => v >= 1000 ? `€${(v/1000).toFixed(0)}k` : `€${v}`
            }
          }
        }
      }
    });
  }

  return { renderPie, renderBar };
})();
