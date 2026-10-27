// A classic script can explain file:// restrictions even when modules cannot run.
(() => {
  const status = document.getElementById('status');
  const controls = document.querySelectorAll('.calendar-toolbar button, .calendar-toolbar input');
  controls.forEach(control => { control.disabled = true; });

  if (location.protocol === 'file:') {
    status.className = 'status';
    status.textContent = 'Open the calendar through a web address. Your browser cannot load its data when index.html is opened directly as a file.';
    const paragraph = document.createElement('p');
    const link = document.createElement('a');
    link.href = 'http://127.0.0.1:4173/';
    link.textContent = 'Open local preview →';
    paragraph.append(link);
    const help = document.createElement('p');
    help.textContent = 'If the preview is not running, run “python3 -m http.server 4173” in this folder. Once published, simply open your GitHub Pages website. No backend is required.';
    status.append(paragraph, help);
    return;
  }

  import('./app.js').catch(error => {
    status.hidden = false;
    status.className = 'status error';
    status.textContent = 'The calendar could not start. Refresh the page and check that app.js and calendar.mjs were uploaded alongside index.html.';
    console.error('Calendar startup failed:', error);
  });
})();
