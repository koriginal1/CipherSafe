
document.addEventListener('DOMContentLoaded', () => {

  const ciphertextInput =
    document.getElementById('ciphertextInput');

  const charCount = document.getElementById('charCount');

  if (ciphertextInput && charCount) {
    const updateCharacterCount = () => {
      charCount.textContent =
        `${ciphertextInput.value.length}/1000`;
    };

    ciphertextInput.addEventListener(
      'input',
      updateCharacterCount
    );

    updateCharacterCount();
  }

  const keyInput = document.getElementById('keyInput');

  const toggleKeyVisibilityBtn =
    document.getElementById('toggleKeyVisibility');

  const eyeIcon = document.getElementById('eyeIcon');

  if (keyInput && toggleKeyVisibilityBtn) {
    toggleKeyVisibilityBtn.addEventListener('click', () => {
      const isPassword = keyInput.type === 'password';

      keyInput.type = isPassword ? 'text' : 'password';

      if (eyeIcon) {
        eyeIcon.innerHTML = isPassword
          ? `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20
            c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94
            M9.9 4.24A9.12 9.12 0 0 1 12 4
            c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19
            m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          `
          : `
            <path d="M1 12s4-8 11-8 11 8 11 8
            -4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          `;
      }
    });
  }

  // Algorithm Selection and Display

  const algorithmSelect =
    document.getElementById('algorithmSelect');

  const metaAlgo = document.getElementById('metaAlgo');

  if (algorithmSelect && metaAlgo) {
    const updateAlgorithmDisplay = () => {
      metaAlgo.textContent = algorithmSelect.value;
    };

    algorithmSelect.addEventListener(
      'change',
      updateAlgorithmDisplay
    );

    updateAlgorithmDisplay();
  }



  // Key Input and Display


  const metaKey = document.getElementById('metaKey');

  if (keyInput && metaKey) {
    const updateKeyStatus = () => {
      const hasKey = keyInput.value.trim().length > 0;

      metaKey.textContent = hasKey ? 'provided' : '(hidden)';
      metaKey.style.color = hasKey ? '#10b981' : '';
    };

    keyInput.addEventListener('input', updateKeyStatus);
    updateKeyStatus();
  }

  // Copy Button Functionality

  const copyBtn = document.getElementById('copyBtn');

  const copyText = document.getElementById('copyText');

  const decryptedOutput =
    document.getElementById('decryptedOutput');

  const decryptBtn = document.getElementById('decryptBtn');

  if (
    decryptBtn &&
    ciphertextInput &&
    algorithmSelect &&
    keyInput &&
    decryptedOutput
  ) {
    decryptBtn.addEventListener('click', async () => {
      const text = ciphertextInput.value;
      const algorithm = algorithmSelect.value;
      const key = keyInput.value;

      if (!text.trim()) {
        decryptedOutput.textContent = 'Please enter ciphertext to decrypt.';
        decryptedOutput.style.color = '#ef4444';
        return;
      }

      decryptBtn.disabled = true;
      decryptBtn.style.opacity = '0.7';
      decryptedOutput.style.color = '';
      decryptedOutput.textContent = 'Decrypting...';

      try {
        const response = await fetch('/api/decrypt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text, algorithm, key })
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Decryption failed.');
        }

        decryptedOutput.textContent = data.result;
        window.dispatchEvent(new Event('history-updated'));
      } catch (error) {
        decryptedOutput.textContent =
          error.message || 'Unable to connect to the server.';
        decryptedOutput.style.color = '#ef4444';
        console.error('Decryption error:', error);
      } finally {
        decryptBtn.disabled = false;
        decryptBtn.style.opacity = '';
      }
    });
  }

  if (copyBtn && decryptedOutput) {
    copyBtn.addEventListener('click', async () => {
      const output = decryptedOutput.textContent.trim();

      if (
        !output ||
        output === 'Your decrypted message will appear here...'
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

  const cards = document.querySelectorAll(
    '.decrypt-layout .card'
  );

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((item) =>
        item.classList.remove('active-glow')
      );

      card.classList.add('active-glow');
    });
  });

});
