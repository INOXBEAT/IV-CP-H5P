// Llamado al cargar el DOM
document.addEventListener('DOMContentLoaded', function () {
    console.log('[DOMContentLoaded] El DOM ha sido completamente cargado.');

    // Crear un observador para detectar el iframe de H5P
    const observer = new MutationObserver(() => {
        const iframe = document.querySelector('iframe');
        if (iframe) {
            console.log('[DOMContentLoaded] iframe detectado en el DOM.');

            if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
                console.log('[DOMContentLoaded] iframe cargado completamente.');

                observer.disconnect(); // Detener el observador
                const h5pDocument = iframe.contentDocument || iframe.contentWindow.document;

                try {
                    // Llamada para inicializar contenido
                    initializeH5PContent(h5pDocument);
                    console.log('[DOMContentLoaded] Función initializeH5PContent llamada correctamente.');
                } catch (error) {
                    console.error('[DOMContentLoaded] Error al inicializar contenido H5P:', error.message);
                }
            } else {
                console.warn('[DOMContentLoaded] iframe detectado pero aún no está completamente cargado.');
            }
        }
    });

    // Configurar el observador en el cuerpo del documento
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[DOMContentLoaded] Observador configurado para detectar cambios en el DOM.');
});

// Inicialización del contenido H5P
function initializeH5PContent(h5pDocument) {
    console.log('[initializeH5PContent] Inicializando contenido H5P.');

    // Cargar estilos básicos (Bootstrap)
    const link = h5pDocument.createElement('link');
    link.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css";
    link.rel = "stylesheet";
    link.crossOrigin = "anonymous";
    h5pDocument.head.appendChild(link);
    console.log('[initializeH5PContent] Estilos Bootstrap cargados.');

    // Detectar tipo de recurso
    const isInteractiveVideo = h5pDocument.querySelector('.h5p-video-wrapper');
    const isCoursePresentation = h5pDocument.querySelector('.h5p-slide');

    if (isInteractiveVideo) {
        console.log('[initializeH5PContent] Recurso identificado: Interactive Video.');
        initializeInteractiveVideo(h5pDocument);
    } else if (isCoursePresentation) {
        console.log('[initializeH5PContent] Recurso identificado: Course Presentation.');
        initializeCoursePresentation(h5pDocument);
    } else {
        console.warn('[initializeH5PContent] No se pudo identificar el tipo de recurso H5P.');
    }
}

// Inicialización específica para Interactive Video
function initializeInteractiveVideo(h5pDocument) {
    console.log('[initializeInteractiveVideo] Inicializando recurso Interactive Video.');

    const h5pContainer = h5pDocument.querySelector('.h5p-content');
    if (!h5pContainer) {
        console.warn('[initializeInteractiveVideo] No se encontró el contenedor principal de H5P.');
        return;
    }

    const trackElements = h5pDocument.querySelectorAll('track');
    if (!trackElements.length) {
        console.warn('[initializeInteractiveVideo] No se encontraron etiquetas <track> en el contenido H5P.');
        return;
    }

    console.log('[initializeInteractiveVideo] Se detectaron tracks de subtítulos.');

    const captionsContainer = setupContainerLayout(h5pDocument, h5pContainer, 'captions-container-iv');

    trackElements.forEach(track => {
        const trackSrc = track.getAttribute('src');
        if (trackSrc) {
            fetch(trackSrc)
                .then(response => response.text())
                .then(vttData => {
                    const captions = processVTT(vttData);
                    console.log('[initializeInteractiveVideo] Subtítulos procesados.');

                    setupCaptions(h5pDocument, captions, captionsContainer, 'iv');

                    const videoElement = h5pDocument.querySelector('video');
                    if (videoElement) {
                        // Llamada a la sincronización después de preparar todo
                        syncSubtitlesWithScroll(videoElement, captions, h5pDocument, 'iv');
                    }
                })
                .catch(error => console.error('[initializeInteractiveVideo] Error al procesar archivo VTT:', error.message));
        } else {
            console.warn('[initializeInteractiveVideo] El track no tiene un atributo src válido.');
        }
    });
}

// Configuración del diseño para contenedor de video y subtítulos
function setupContainerLayout(h5pDocument, h5pContainer, captionsContainerId) {
    console.log('[setupContainerLayout] Configurando diseño para el contenedor.');

    // Crear un contenedor principal
    const container = h5pDocument.createElement('div');
    container.classList.add('container-fluid');
    container.style.maxHeight = '100vh';
    h5pDocument.body.appendChild(container);

    // Crear una fila para dividir el video y los subtítulos
    const row = h5pDocument.createElement('div');
    row.classList.add('row');
    container.appendChild(row);

    // Columna para el video
    const colH5P = h5pDocument.createElement('div');
    colH5P.classList.add('col-12', 'col-sm-8'); // Tamaño adaptable
    colH5P.id = 'col-h5p'; 
    colH5P.style.maxHeight = '100%';
    colH5P.appendChild(h5pContainer); // Insertar el contenedor original de H5P
    row.appendChild(colH5P);

    // Columna para los subtítulos
    const colText = h5pDocument.createElement('div');
    colText.classList.add('col-12', 'col-sm-4'); // Tamaño adaptable
    colText.id = captionsContainerId;
    colText.style.display = 'flex';
    colText.style.flexDirection = 'column';
    colText.style.maxHeight = '100vh';
    
    const captionsContainer = h5pDocument.createElement('div');
    captionsContainer.id = 'captions-content';
    captionsContainer.style.flexGrow = '1';
    captionsContainer.style.overflowY = 'auto';
    captionsContainer.style.padding = '10px';

    colText.appendChild(captionsContainer);
    row.appendChild(colText);

    console.log('[setupContainerLayout] Diseño configurado correctamente.');
    return captionsContainer;
}

// Procesar archivo VTT en subtítulos estructurados
function processVTT(vttContent) {
    console.log('[processVTT] Procesando archivo VTT.');

    const lines = vttContent.split('\n');
    const captions = [];
    let currentCaption = null;

    lines.forEach(line => {
        line = line.trim();
        
        // Ignorar encabezado WEBVTT
        if (line === 'WEBVTT' || line === '') {
            return;
        }

        // Detectar rango de tiempo (ej. 00:00:01.000 --> 00:00:05.000)
        if (line.includes('-->')) {
            if (currentCaption) {
                captions.push(currentCaption); // Guardar el subtítulo anterior
            }
            const [start, end] = line.split(' --> ');
            currentCaption = {
                start: parseTime(start), // Convertir a segundos
                end: parseTime(end), // Convertir a segundos
                text: ''
            };
        } 
        // Acumular texto del subtítulo
        else if (currentCaption && line) {
            currentCaption.text += line + ' ';
        }
    });

    // Agregar el último subtítulo si está presente
    if (currentCaption) {
        captions.push(currentCaption);
    }

    console.log(`[processVTT] Archivo VTT procesado. Subtítulos encontrados: ${captions.length}`);
    return captions;
}

// Convertir tiempo en formato VTT a segundos
function parseTime(timeString) {
    const parts = timeString.split(':');
    const seconds = parseFloat(parts[2]);
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + seconds;
}

// Configurar los subtítulos procesados en el contenedor
function setupCaptions(h5pDocument, captions, colText, type) {
    console.log('[setupCaptions] Configurando subtítulos en el contenedor.');

    // Limpiar contenido existente en el contenedor
    colText.innerHTML = '';

    // Crear estilo para subtítulos
    const style = h5pDocument.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        .transcription-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .transcription-item:hover {
            background-color: #f0f0f0;
        }
        .left-column {
            flex: 1;
            text-align: center;
        }
        .timestamp-button {
            background: none;
            border: none;
            color: #0078d4;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
        }
        .right-column {
            flex: 5;
            font-size: 14px;
            color: #333;
            padding-left: 8px;
            text-align: justify;
        }
        .highlighted {
            background-color: #cae4e8;
            font-weight: bold;
        }
    `;
    h5pDocument.head.appendChild(style);

    // Insertar cada subtítulo como un elemento de lista interactivo
    captions.forEach((caption, index) => {
        const listItem = h5pDocument.createElement('div');
        listItem.classList.add('transcription-item');
        listItem.setAttribute('role', 'listitem');
        listItem.id = `caption-${type}-${index}`;

        // Columna izquierda: Botón con marca de tiempo
        const leftColumn = h5pDocument.createElement('div');
        leftColumn.classList.add('left-column');
        const timeButton = h5pDocument.createElement('button');
        timeButton.classList.add('timestamp-button');
        timeButton.textContent = formatTime(caption.start);
        timeButton.onclick = () => {
            const videoElement = h5pDocument.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = caption.start;
                videoElement.play();
            }
        };
        leftColumn.appendChild(timeButton);

        // Columna derecha: Texto del subtítulo
        const rightColumn = h5pDocument.createElement('div');
        rightColumn.classList.add('right-column');
        rightColumn.textContent = caption.text.trim();
        rightColumn.onclick = () => {
            const videoElement = h5pDocument.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = caption.start;
                videoElement.play();
            }
        };

        listItem.appendChild(leftColumn);
        listItem.appendChild(rightColumn);

        colText.appendChild(listItem);
    });

    console.log('[setupCaptions] Subtítulos configurados en el contenedor.');
}

// Formatear tiempo de segundos a formato mm:ss
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Sincronizar subtítulos con el video y desplazar el subtítulo resaltado al centro
function syncSubtitlesWithScroll(videoElement, captions, h5pDocument, type, slideIndex = null) {
    console.log('[syncSubtitlesWithScroll] Configurando sincronización de subtítulos con el video.');

    const colTextId = slideIndex !== null ? `captions-container-slide-${slideIndex}` : `captions-container-${type}`;
    const colText = h5pDocument.getElementById(colTextId);

    if (!colText) {
        console.warn(`[syncSubtitlesWithScroll] No se encontró el contenedor de subtítulos con ID: ${colTextId}`);
        return;
    }

    // Variables para manejar la interacción del usuario
    let isUserInteracting = false;
    let inactivityTimeout;

    // Función que maneja el centrado del subtítulo
    const handleTimeUpdate = () => {
        const currentTime = videoElement.currentTime;

        captions.forEach((caption, index) => {
            const captionId = slideIndex !== null ? `caption-slide-${slideIndex}-${index}` : `caption-${type}-${index}`;
            const captionElement = h5pDocument.getElementById(captionId);
            if (!captionElement) return;

            // Resaltar el subtítulo activo
            if (currentTime >= caption.start && currentTime <= caption.end) {
                captionElement.classList.add('highlighted');

                // Solo centrar si el usuario no está interactuando
                if (!isUserInteracting) {
                    const elementOffset = captionElement.offsetTop - colText.offsetTop;
                    const scrollTo = elementOffset - (colText.clientHeight / 2) + (captionElement.clientHeight / 2);

                    colText.scrollTo({ top: scrollTo, behavior: 'smooth' });
                    console.log(`[syncSubtitlesWithScroll] Subtítulo centrado en índice ${index}`);
                }
            } else {
                captionElement.classList.remove('highlighted');
            }
        });
    };

    // Función para manejar la interacción del usuario
    const resetInactivityTimer = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        isUserInteracting = true;

        inactivityTimeout = setTimeout(() => {
            isUserInteracting = false;
            console.log('[syncSubtitlesWithScroll] Usuario inactivo. Centrando subtítulo nuevamente.');
        }, 3500); // Tiempo de inactividad
    };

    // Añadir eventos para manejar interacción del usuario
    colText.addEventListener('scroll', resetInactivityTimer);
    colText.addEventListener('mousemove', resetInactivityTimer);

    // Escuchar el evento `timeupdate` para actualizar subtítulos
    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    console.log('[syncSubtitlesWithScroll] Sincronización configurada correctamente.');
}

// Configurar los subtítulos procesados en el contenedor
function setupCaptions(h5pDocument, captions, colText, type) {
    console.log('[setupCaptions] Configurando subtítulos en el contenedor.');

    // Limpiar contenido existente en el contenedor
    colText.innerHTML = '';

    // Crear estilo para subtítulos
    const style = h5pDocument.createElement('style');
    style.type = 'text/css';
    style.innerHTML = `
        .transcription-item {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .transcription-item:hover {
            background-color: #f0f0f0;
        }
        .left-column {
            flex: 1;
            text-align: center;
        }
        .timestamp-button {
            background: none;
            border: none;
            color: #0078d4;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
        }
        .right-column {
            flex: 5;
            font-size: 14px;
            color: #333;
            padding-left: 8px;
            text-align: justify;
        }
        .highlighted {
            background-color: #cae4e8;
            font-weight: bold;
        }
    `;
    h5pDocument.head.appendChild(style);

    // Insertar cada subtítulo como un elemento de lista interactivo
    captions.forEach((caption, index) => {
        const listItem = h5pDocument.createElement('div');
        listItem.classList.add('transcription-item');
        listItem.setAttribute('role', 'listitem');
        listItem.id = `caption-${type}-${index}`;

        // Limpiar texto para eliminar IDs o caracteres no deseados
        const cleanedText = caption.text.replace(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-\d+)/g, '').trim();

        // Columna izquierda: Botón con marca de tiempo
        const leftColumn = h5pDocument.createElement('div');
        leftColumn.classList.add('left-column');
        const timeButton = h5pDocument.createElement('button');
        timeButton.classList.add('timestamp-button');
        timeButton.textContent = formatTime(caption.start);
        timeButton.onclick = () => {
            const videoElement = h5pDocument.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = caption.start;
                videoElement.play();
            }
        };
        leftColumn.appendChild(timeButton);

        // Columna derecha: Texto del subtítulo
        const rightColumn = h5pDocument.createElement('div');
        rightColumn.classList.add('right-column');
        rightColumn.textContent = cleanedText; // Usar el texto limpio
        rightColumn.onclick = () => {
            const videoElement = h5pDocument.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = caption.start;
                videoElement.play();
            }
        };

        listItem.appendChild(leftColumn);
        listItem.appendChild(rightColumn);

        colText.appendChild(listItem);
    });

    console.log('[setupCaptions] Subtítulos configurados en el contenedor.');
}

