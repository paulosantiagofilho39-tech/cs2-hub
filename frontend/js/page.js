// Comportamento comum das páginas internas: filtros (via URL) e estado vazio.
document.addEventListener('DOMContentLoaded', () => {
  const { el, emptyState } = window.HUB;
  const stage = document.body.dataset.stage;
  const params = new URLSearchParams(location.search);

  // Filtros: chips que atualizam a URL (compartilhável) e o estado ativo.
  const box = document.getElementById('filters');
  const filters = JSON.parse(box.dataset.filters || '[]');
  const paramName = document.body.dataset.page === 'rankings' ? 'period' : 'status';
  const current = params.get(paramName) || (filters[0] && filters[0][0]);

  filters.forEach(([value, label]) => {
    const chip = el('button', { class: 'chip' + (value === current ? ' active' : ''), type: 'button', text: label });
    chip.addEventListener('click', () => {
      params.set(paramName, value);
      history.replaceState(null, '', '?' + params.toString());
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
    box.appendChild(chip);
  });
  if (!filters.length) box.remove();

  // Mapas: lista dos 8 mapas competitivos (sem estatísticas inventadas).
  const mapsBox = document.getElementById('maps-grid');
  if (mapsBox) {
    JSON.parse(mapsBox.dataset.maps).forEach((name) => {
      mapsBox.appendChild(el('div', { class: 'card map-card' }, [
        document.createTextNode(name),
        el('small', { text: 'Estatísticas em breve' }),
      ]));
    });
  }

  const q = params.get('q');
  const msg = q
    ? `Busca por "${q}": a pesquisa real será ativada na Etapa 3.`
    : `Esta seção receberá dados reais na Etapa ${stage}.`;
  document.getElementById('content').appendChild(emptyState('Sem dados ainda', msg));
});
