

/**
 * ============================================================================================
 * NÃO UTILIZAR: Este bloco serve apenas para configurar o ambiente virtual da UI das Overlays de Ajuda e Vídeo.
 * ============================================================================================
 */

const overlay = document.getElementById('overlay');
const helpButton = document.getElementById('help-button');
const helpCloseButton = document.getElementById('help-close-button');
const annotationsToggle = document.getElementById('annotations-toggle');
const videoButton = document.getElementById('video-button');
const videoOverlay = document.getElementById('video-overlay');
const videoCloseButton = document.getElementById('video-close-button');

helpButton.addEventListener('click', () => {
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden'; 
});

helpCloseButton.addEventListener('click', () => {
    overlay.classList.remove('show');
    document.body.style.overflow = ''; 
});

annotationsToggle.addEventListener('click', () => {
    const isPressed = annotationsToggle.getAttribute('aria-pressed') === 'true';
    const newState = !isPressed;
    annotationsToggle.setAttribute('aria-pressed', String(newState));
    overlay.classList.toggle('show-annotations');
    
    const image1 = overlay.querySelector('img[alt="Imagem de ajuda"]');
    const image2 = overlay.querySelector('img[alt="Informação sem filtros"]');
    
    if (newState) {
        image1.style.display = 'none';
        image2.style.display = 'block';
    } else {
        image1.style.display = 'block';
        image2.style.display = 'none';
    }
    
    const textSpan = annotationsToggle.querySelector('span');
    if (textSpan) {
        textSpan.textContent = newState ? 'Mostrar com Anotações' : 'Mostrar sem Anotações';
    }
});

videoButton.addEventListener('click', () => {
    videoOverlay.classList.add('show');
    const video = videoOverlay.querySelector('video');
    video.currentTime = 0;
    video.play().catch(e => console.error('Error playing video:', e));
});

videoCloseButton.addEventListener('click', () => {
    videoOverlay.classList.remove('show');
    const video = videoOverlay.querySelector('video');
    video.pause();
});

[overlay, videoOverlay].forEach(overlayEl => {
    overlayEl.addEventListener('click', (e) => {
        if (e.target === overlayEl) {
            overlayEl.classList.remove('show');
            document.body.style.overflow = '';
            
            if (overlayEl === videoOverlay) {
                const video = overlayEl.querySelector('video');
                video.pause();
            }
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (overlay.classList.contains('show')) {
            overlay.classList.remove('show');
            document.body.style.overflow = '';
        }
        if (videoOverlay.classList.contains('show')) {
            videoOverlay.classList.remove('show');
            const video = videoOverlay.querySelector('video');
            video.pause();
        }
    }
});
