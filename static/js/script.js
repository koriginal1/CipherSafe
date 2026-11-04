const savedTheme = localStorage.getItem('theme');
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
const initialLightTheme = savedTheme === 'light' || (!savedTheme && prefersLight);

if (initialLightTheme) {
  document.documentElement.classList.add('light-theme');
}


document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('themeToggleBtn');

  // SVG Path Data for Sun and Moon icons
  const sunIconHTML = `
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2m0 16v2m10-10h-2M4 12H2"/>
    <path d="m19.07 4.93-1.41 1.41M6.34 17.66l-1.41 1.41"/>
    <path d="m17.66 17.66 1.41 1.41M6.34 6.34 4.93 4.93"/>
  `;

  const moonIconHTML = `
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  `;

  // Function to update the SVG content based on current theme
  function updateIcon(isLight) {
    if (!themeBtn) return;
    const svg = themeBtn.querySelector('svg');
    if (svg) {
      // In light theme, show moon icon (to switch to dark). In dark theme, show sun icon.
      svg.innerHTML = isLight ? moonIconHTML : sunIconHTML;
    }
  }

  if (initialLightTheme) {
    document.body.classList.add('light-theme');
  }
  updateIcon(initialLightTheme);


  // Toggle theme on button click
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const toggleTheme = () => {
        const isLight = document.documentElement.classList.toggle('light-theme');
        document.body.classList.toggle('light-theme', isLight);

        // Save user preference
        localStorage.setItem('theme', isLight ? 'light' : 'dark');

        // Update icon
        updateIcon(isLight);
      };

      if (document.startViewTransition) {
        document.startViewTransition(toggleTheme);
      } else {
        toggleTheme();
      }
    });
  }


  // Navigation Active State Detector
  const navLinks = document.querySelectorAll('.nav-links a');
  
  // Extract clean file name from location
  let currentFile = window.location.pathname.split('/').pop().split('?')[0].split('#')[0];
  
  if (!currentFile || currentFile === '') {
    currentFile = 'home.html';
  }

  navLinks.forEach((link) => {
    const linkHref = link.getAttribute('href');

    // Reset state
    link.classList.remove('active');

    // Match page link against current URL
    if (linkHref === currentFile) {
      link.classList.add('active');
    }

    // Handle hash/in-page anchor links
    link.addEventListener('click', function () {
      const href = this.getAttribute('href');
      if (href.startsWith('#')) {
        navLinks.forEach((l) => l.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });
});