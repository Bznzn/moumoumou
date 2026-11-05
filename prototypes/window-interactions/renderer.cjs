function render(state) {
  const labels = { through: '对照：穿透', drag: '对照：拖动', combined: '实验组合', blocked: '实验受阻，当前仅穿透' };
  document.getElementById('status').textContent = state.mode === 'blocked'
    ? '实验组合没有启用：缺少辅助功能权限。请先决定是否为 build/SalaryGestureProbe.app 授权，再重新点击实验按钮。当前仍是纯穿透，不能拖动。'
    : `${labels[state.mode]} · 原生适配${state.nativeReady ? '已连接（仍需实测）' : '未连接'} · 悬停 ${state.hovered} · 拖动 ${state.dragging}`;
  document.getElementById('events').textContent = state.events.map(event => JSON.stringify(event)).join('\n');
}
window.probe.getState().then(render);
window.probe.onState(render);
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => window.probe.action(button.dataset.action).then(render).catch(error => { document.getElementById('status').textContent = error.message; })));
