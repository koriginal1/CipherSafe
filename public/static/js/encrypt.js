
document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('textInput');
  const charCount = document.getElementById('charCount');
  const keyInput = document.getElementById('keyInput');
  const toggleKeyVisibilityBtn =
    document.getElementById('toggleKeyVisibility');
  const eyeIcon = document.getElementById('eyeIcon');

  const algorithmSelect =
    document.getElementById('algorithmSelect');
  const metaAlgo = document.getElementById('metaAlgo');
  const metaKey = document.getElementById('metaKey');

  const encryptBtn = document.getElementById('encryptBtn');
  const encryptedOutput =
    document.getElementById('encryptedOutput');
  const cryptoWarning = document.getElementById('cryptoWarning');

  const copyBtn = document.getElementById('copyBtn');
  const copyText = document.getElementById('copyText');

  // Character counter
  function updateCharacterCount() {
    if (textInput && charCount) {
      charCount.textContent = `${textInput.value.length}/1000`;
    }
  }

  if (textInput) {
    textInput.addEventListener('input', updateCharacterCount);
    updateCharacterCount();
  }

  // Show or hide encryption key
  if (keyInput && toggleKeyVisibilityBtn) {
    toggleKeyVisibilityBtn.addEventListener('click', () => {
      const showKey = keyInput.type === 'password';
      keyInput.type = showKey ? 'text' : 'password';

      if (eyeIcon) {
        eyeIcon.innerHTML = showKey
          ? '<path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5-6M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2 3M1 1l22 22"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }

  // Update algorithm and key status
  function updateMetadata() {
    if (algorithmSelect && metaAlgo) {
      metaAlgo.textContent = algorithmSelect.value;
    }

    if (keyInput && metaKey) {
      const hasKey = keyInput.value.trim().length > 0;
      metaKey.textContent = hasKey ? 'provided' : '(hidden)';
      metaKey.style.color = hasKey ? '#10b981' : '';
    }
  }

  if (algorithmSelect) {
    algorithmSelect.addEventListener('change', updateMetadata);
  }

  if (keyInput) {
    keyInput.addEventListener('input', updateMetadata);
  }

  updateMetadata();

  // ENCRYPT: Send the message to Flask
  if (encryptBtn && textInput && encryptedOutput) {
    encryptBtn.addEventListener('click', async () => {
      const text = textInput.value;
      const algorithm = algorithmSelect.value;
      const key = keyInput.value;

      if (!text.trim()) {
        encryptedOutput.textContent =
          'Please enter a message to encrypt.';
        encryptedOutput.style.color = '#ef4444';
        if (cryptoWarning) cryptoWarning.hidden = true;
        return;
      }

      encryptBtn.disabled = true;
      encryptBtn.style.opacity = '0.7';
      encryptedOutput.style.color = '';
      encryptedOutput.textContent = 'Encrypting...';
      if (cryptoWarning) cryptoWarning.hidden = true;

      try {
        const response = await fetch('/api/encrypt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            algorithm: algorithm,
            key: key
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Encryption failed.');
        }

        encryptedOutput.textContent = data.result;
        window.dispatchEvent(new Event('history-updated'));
        if (cryptoWarning && data.warning) {
          cryptoWarning.textContent = data.warning;
          cryptoWarning.hidden = false;
        }
      } catch (error) {
        encryptedOutput.textContent =
          error.message || 'Unable to connect to the server.';
        encryptedOutput.style.color = '#ef4444';
        if (cryptoWarning) cryptoWarning.hidden = true;
        console.error('Encryption error:', error);
      } finally {
        encryptBtn.disabled = false;
        encryptBtn.style.opacity = '';
      }
    });
  }

  // Copy encrypted output
  if (copyBtn && encryptedOutput) {
    copyBtn.addEventListener('click', async () => {
      const output = encryptedOutput.textContent.trim();

      if (
        !output ||
        output === 'Your Encrypted message will appear here...' ||
        output === 'Encrypting...'
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(output);

        if (copyText) {
          const originalText = copyText.textContent;
          copyText.textContent = 'Copied!';

          setTimeout(() => {
            copyText.textContent = originalText || 'Copy';
          }, 1500);
        }
      } catch (error) {
        console.error('Unable to copy text:', error);
      }
    });
  }

  // Card
  const cards = document.querySelectorAll('.encrypt-layout .card');

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((item) => {
        item.classList.remove('active-glow');
      });

      card.classList.add('active-glow');
    });
  });
});
