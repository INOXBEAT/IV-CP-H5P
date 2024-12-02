// Llamado para inicializar el contenido con los controles
document.addEventListener('DOMContentLoaded', function () {
    const observer = new MutationObserver(() => {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            observer.disconnect();
            addSubtitleStyles(iframe.contentDocument);
            initializeH5PContentWithControls(iframe.contentDocument);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

// Identifica el contenedor de video y el elemento <track> dentro del iframe H5P
function identifyVideoAndTrackElements(iframeDocument) {
    const interactiveVideoContainer = iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-interactive-video');
    const trackElement = iframeDocument.querySelector('track');
    
    return (interactiveVideoContainer && trackElement) 
        ? { interactiveVideoContainer, trackElement } 
        : (console.warn("No se encontró el contenedor de video o el elemento <track>."), null);
}

// Creación de contenedor principal y flex
function createMainContainer(iframeDocument) {
    const mainContainer = iframeDocument.createElement('div');
    mainContainer.id = 'main-flex-container';
    iframeDocument.body.appendChild(mainContainer);
    return mainContainer;
}

// Crea un elemento flexbox con secciones A y B
function createFlexboxSections(mainContainer, iframeDocument) {
    const flexContainer = iframeDocument.createElement('div');
    flexContainer.classList.add('flex-container');

    const createSection = (className) => {
        const section = iframeDocument.createElement('div');
        section.classList.add(className);
        return section;
    };

    const sectionA = createSection('section-a');
    const sectionB = createSection('section-b');
    flexContainer.append(sectionA, sectionB);
    mainContainer.appendChild(flexContainer);

    return { sectionA, sectionB };
}

// Inserta el contenedor de video y formatea el contenido de subtítulos en la sección B
function placeResourcesInSections(sectionA, sectionB, interactiveVideoContainer, trackElement) {
    sectionA.appendChild(interactiveVideoContainer);
    if (trackElement.src) {
        fetch(trackElement.src)
            .then(response => response.ok ? response.text() : Promise.reject(`Error ${response.status}: ${response.statusText}`))
            .then(vttContent => {
                const captions = processVTT(vttContent);
                formatCaptions(sectionB, captions);
                addTimeUpdateEvent(sectionA.querySelector('video'), captions, sectionB);
            })
            .catch(error => {
                console.warn("Error al cargar el contenido del <track>:", error.message);
                sectionB.textContent = "No se pudo mostrar el contenido del <track>.";
            });
    } else {
        console.warn("El <track> no tiene contenido disponible.");
        sectionB.textContent = "El <track> no tiene contenido disponible.";
    }
}

// Función para procesar el archivo VTT en un arreglo de subtítulos con tiempo
function processVTT(vttContent) {
    const lines = vttContent.split('\n');
    const captions = [];
    let currentCaption = null;

    lines.forEach(line => {
        if (line.includes('-->')) {
            if (currentCaption) captions.push(currentCaption);
            const [start, end] = line.split(' --> ');
            currentCaption = { start: parseTime(start), end: parseTime(end), text: '' };
        } else if (line.trim() && currentCaption) {
            currentCaption.text += line.trim() + ' ';
        }
    });

    if (currentCaption) captions.push(currentCaption);
    return captions;
}

// Convierte un tiempo de formato VTT (00:00:00.000) a segundos
function parseTime(timeString) {
    const parts = timeString.split(':');
    const seconds = parseFloat(parts[2]);
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + seconds;
}

// Agrega opciones de transcripción y controles de tamaño de fuente en el menú de subtítulos
function createTranscriptionAndFontSizeOptions(h5pDocument, menuList, sectionA, sectionB) {
    const transcriptionOption = h5pDocument.createElement('li');
    transcriptionOption.classList.add('transcription-option');
    transcriptionOption.setAttribute('role', 'menuitemradio');
    transcriptionOption.setAttribute('aria-checked', 'false');
    transcriptionOption.textContent = 'Transcripción';
    transcriptionOption.style.cursor = 'pointer';
    transcriptionOption.addEventListener('click', () => toggleTranscriptionVisibility(sectionA, sectionB, transcriptionOption));
    menuList.appendChild(transcriptionOption);

    const fontSizeControlItem = h5pDocument.createElement('li');
    const iconContainer = h5pDocument.createElement('div');
    fontSizeControlItem.textContent = 'Tamaño de letra';
    fontSizeControlItem.style.margin = '0px 32px';
    Object.assign(iconContainer.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' });

    // Crear iconos de ajuste de tamaño de fuente
    const increaseFontIcon = createFontSizeIcon(h5pDocument, 'Increase Font Size', 24, 'https://cdn4.iconfinder.com/data/icons/ionicons/512/icon-plus-round-512.png');
    const decreaseFontIcon = createFontSizeIcon(h5pDocument, 'Decrease Font Size', 24, 'https://cdn4.iconfinder.com/data/icons/ionicons/512/icon-minus-round-512.png');

    // Eventos para ajustar el tamaño de fuente
    let currentFontSize = 16;
    sectionB.style.fontSize = `${currentFontSize}px`;

    increaseFontIcon.onclick = () => adjustFontSize(currentFontSize += 2, sectionB, 34);
    decreaseFontIcon.onclick = () => adjustFontSize(currentFontSize -= 2, sectionB, 10);

    iconContainer.append(increaseFontIcon, decreaseFontIcon);
    fontSizeControlItem.appendChild(iconContainer);
    menuList.appendChild(fontSizeControlItem);
}

// Función auxiliar para crear icono de ajuste de tamaño de fuente
function createFontSizeIcon(h5pDocument, alt, size, src) {
    const icon = h5pDocument.createElement('img');
    Object.assign(icon, { alt, src });
    Object.assign(icon.style, {
        width: `${size}px`,
        height: `${size}px`,
        cursor: 'pointer',
        margin: '0 8px',
        filter: 'invert(1) sepia(0) saturate(0) hue-rotate(180deg) brightness(200%)',
        border: '2px solid #000000',
        borderRadius: '4px'
    });
    return icon;
}

// Alterna la visibilidad de la sección de transcripción
function toggleTranscriptionVisibility(sectionA, sectionB, transcriptionOption) {
    const isVisible = sectionB.style.display === 'none';
    sectionB.style.display = isVisible ? 'block' : 'none';

    // Controlar el tamaño de sectionA en móvil
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        sectionA.style.height = isVisible ? '70%' : '100%';
    } else {
        sectionA.style.width = isVisible ? '66.66%' : '100%';
    }

    transcriptionOption.setAttribute('aria-checked', isVisible.toString());
    console.log(`[toggleTranscriptionVisibility] Transcripción ${isVisible ? 'activada' : 'desactivada'}.`);
}


// Ajusta el tamaño de la fuente en la sección de transcripción
function adjustFontSize(size, sectionB, limit) {
    if (size >= 10 && size <= 34) {
        sectionB.style.fontSize = `${size}px`;

        const timeColumns = sectionB.querySelectorAll('.time-column');
        const textColumns = sectionB.querySelectorAll('.text-column');

        timeColumns.forEach(column => column.style.fontSize = `${size}px`);
        textColumns.forEach(column => column.style.fontSize = `${size}px`);
    }
}

// Formatea y muestra los subtítulos en sectionB
function formatCaptions(sectionB, captions) {
    sectionB.innerHTML = '';
    const iframeDocument = sectionB.ownerDocument;
    const videoElement = iframeDocument.querySelector('video');
    if (!videoElement) {
        console.warn("No se encontró el elemento <video> en el iframe.");
        return;
    }
    captions.forEach((caption, index) => {
        const listItem = document.createElement('div');
        listItem.classList.add('list-item');
        listItem.id = `caption-${index}`;
        const timeColumn = document.createElement('div');
        timeColumn.classList.add('time-column');
        timeColumn.textContent = formatTime(caption.start);
        const textColumn = document.createElement('div');
        textColumn.classList.add('text-column');
        textColumn.textContent = caption.text.replace(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-\d+)/gi, '').trim();
        listItem.append(timeColumn, textColumn);
        sectionB.appendChild(listItem);
        listItem.addEventListener('click', () => {
            videoElement.currentTime = caption.start;
            videoElement.play();
        });
    });
}

// Función auxiliar para formatear el tiempo en mm:ss
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Agrega el evento timeupdate al video para sincronizar los subtítulos
function addTimeUpdateEvent(videoElement, captions, sectionB) {
    videoElement.addEventListener('timeupdate', () => {
        const currentTime = videoElement.currentTime;
        captions.forEach((caption, index) => {
            const captionElement = sectionB.querySelector(`#caption-${index}`);
            if (currentTime >= caption.start && currentTime <= caption.end) {
                captionElement.classList.add('highlighted');

                sectionB.scrollTo({
                    top: captionElement.offsetTop - sectionB.clientHeight / 2 + captionElement.clientHeight / 2,
                    behavior: 'smooth'
                });
            } else {
                captionElement.classList.remove('highlighted');
            }
        });
    });
}

// Función de inicialización que configura el contenido, el menú de subtítulos y el comportamiento de pantalla completa
function initializeH5PContentWithControls(iframeDocument) {
    const elements = identifyVideoAndTrackElements(iframeDocument);

    if (elements) {
        const mainContainer = createMainContainer(iframeDocument);
        const { sectionA, sectionB } = createFlexboxSections(mainContainer, iframeDocument);
        placeResourcesInSections(sectionA, sectionB, elements.interactiveVideoContainer, elements.trackElement);

        // Ajustar altura de sectionB al cargar el contenido
        adjustSectionBHeight(sectionA, sectionB);

        // Configuración del modo de pantalla completa
        setupFullscreenBehavior(iframeDocument, sectionA, sectionB);

        // Configuración del menú de subtítulos
        const controlsContainer = iframeDocument.querySelector('.h5p-controls');
        if (controlsContainer) {
            const observer = new MutationObserver(() => {
                const captionsButton = controlsContainer.querySelector('.h5p-control.h5p-captions');
                if (captionsButton) {
                    captionsButton.click(); // Forzamos la apertura del menú de subtítulos para detectar opciones
                    observer.disconnect();

                    const captionsMenu = iframeDocument.querySelector('.h5p-chooser.h5p-captions ol');
                    if (captionsMenu) {
                        // Crear y agregar las opciones de transcripción y ajuste de fuente
                        createTranscriptionAndFontSizeOptions(iframeDocument, captionsMenu, sectionA, sectionB);
                    } else {
                        console.warn("No se encontró el menú de subtítulos.");
                    }
                }
            });
            observer.observe(controlsContainer, { childList: true, subtree: true });
        } else {
            console.warn("No se encontró el contenedor de controles (.h5p-controls) en el iframe.");
        }
    }
}

// Agrega una hoja de estilos al iframe para los subtítulos y contenedores
function addSubtitleStyles(iframeDocument) {
    const style = iframeDocument.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        #main-flex-container {
            width: 100%;
            box-sizing: border-box;
            padding: 10px;
        }
        .flex-container {
            display: flex;
            width: 100%;
        }
        .section-a {
            width: 100%;
            background-color: #f0f0f0;
            box-sizing: border-box;
            padding: 10px;
        }
        .section-b {
            width: 33.33%;
            box-sizing: border-box;
            background: #FFFFFF;
            padding: 10px;
            overflow-y: auto;
            display: none;
        }
        .list-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .list-item:hover {
            background-color: #f0f0f0;
        }
        .highlighted {
            background-color: #cae4e8;
            font-weight: bold;
        }
        .time-column {
            flex: 1;
            text-align: center;
            font-weight: bold;
            color: #0078d4;
        }
        .text-column {
            flex: 5;
            font-size: 14px;
            color: #333;
            padding-left: 8px;
            text-align: justify;
        }

        /* Estilos responsivos para pantallas pequeñas */
        @media (max-width: 768px) {
            .flex-container {
                flex-direction: column; /* Cambiar a columna */
            }
            .section-a {
                width: 100%;
                height: 70%; /* Altura fija para video */
            }
            .section-b {
                width: 100%;
                height: auto;
                max-height: 30%; /* Altura máxima para transcripción */
                overflow-y: auto;
                display: block; /* Siempre visible en móvil */
            }
        }
    `;
    iframeDocument.head.appendChild(style);
    console.log('[addSubtitleStyles] Estilos de subtítulos agregados.');
}

// Función de configuración para pantalla completa
function setupFullscreenBehavior(iframeDocument, sectionA, sectionB) {
    const observer = new MutationObserver(() => {
        const fullscreenButton = iframeDocument.querySelector('.h5p-control.h5p-fullscreen');
        const mainContainer = iframeDocument.querySelector('#main-flex-container');
        const flexContainer = iframeDocument.querySelector('.flex-container');

        if (fullscreenButton && mainContainer && sectionA && sectionB && flexContainer) {
            console.log("Todos los elementos necesarios encontrados, configurando pantalla completa.");
            observer.disconnect();

            fullscreenButton.addEventListener('click', () => {
                const isFullscreen = !document.fullscreenElement;

                if (isFullscreen) {
                    mainContainer.requestFullscreen()
                        .then(() => {
                            mainContainer.style.width = '100vw';
                            mainContainer.style.height = '100vh';
                            mainContainer.style.display = 'flex';
                            flexContainer.style.height = '100%';

                            adjustSectionBHeight(sectionA, sectionB); // Ajustar altura en pantalla completa
                        })
                        .catch(err => console.warn("Error al activar pantalla completa:", err));
                } else {
                    document.exitFullscreen()
                        .then(() => {
                            mainContainer.style.width = '';
                            mainContainer.style.height = '';
                            mainContainer.style.display = '';
                            flexContainer.style.height = '';

                            adjustSectionBHeight(sectionA, sectionB); // Restablecer altura al salir
                        })
                        .catch(err => console.warn("Error al salir de pantalla completa:", err));
                }
            });

            // Ajuste de altura en cambios de tamaño de ventana y salida de pantalla completa
            window.addEventListener('resize', () => adjustSectionBHeight(sectionA, sectionB));
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement) {
                    mainContainer.style.width = '';
                    mainContainer.style.height = '';
                    mainContainer.style.display = '';
                    flexContainer.style.height = '';

                    adjustSectionBHeight(sectionA, sectionB); // Ajuste de altura al salir de pantalla completa
                }
            });
        } else {
            if (!fullscreenButton) console.warn("Esperando el botón de pantalla completa.");
            if (!mainContainer) console.warn("Esperando el contenedor principal ('#main-flex-container').");
            if (!sectionA) console.warn("Esperando la sección A ('.section-a').");
            if (!sectionB) console.warn("Esperando la sección B ('.section-b').");
            if (!flexContainer) console.warn("Esperando el contenedor flex ('.flex-container').");
        }
    });

    observer.observe(iframeDocument.body, { childList: true, subtree: true });
}

// Ajusta dinámicamente las alturas para vista móvil o de escritorio
function adjustSectionBHeight(sectionA, sectionB) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        sectionA.style.height = '60%';
        sectionB.style.height = '40%';
    } else {
        const sectionAHeight = sectionA.clientHeight;
        sectionB.style.height = `${sectionAHeight}px`;
    }
}







