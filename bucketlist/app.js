(function () {
  const svg = document.getElementById('us-map');
  Object.keys(US_STATES).forEach(function (abbr) {
    const state = US_STATES[abbr];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', state.path);
    path.setAttribute('id', abbr);
    path.setAttribute('data-name', state.name);
    svg.appendChild(path);
  });
})();
