window.probe.onMode(mode => {
  document.querySelector('main').classList.toggle('drag', mode === 'drag');
  document.getElementById('mode').textContent = mode === 'drag' ? '仅拖动对照' : mode === 'combined' ? '实验连接中' : mode === 'blocked' ? '缺少权限 · 仅穿透' : '仅穿透对照';
});
