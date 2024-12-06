//INICIALIZADOR  -------------------------------------------------------------->

// Llamado para inicializar el contenido con los controles
document.addEventListener('DOMContentLoaded', function () {

    const observer = new MutationObserver(() => {
        const iframe = document.querySelector('iframe');

        if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {

            observer.disconnect();

            // Verificamos el tipo de recurso (IV o CP)
            const resourceType = identifyResourceType(iframe.contentDocument);
            switch (resourceType) {
                
                case 'CP':
                    initializeCoursePresentation(iframe.contentDocument);
                    break;
                
                case 'IV':
                    initializeInteractiveVideo(iframe.contentDocument);
                    break;
                default:
                    console.log("Recurso no identificado.");
                    break;
            }
        } else {
            console.log("El iframe aún no está completamente cargado.");
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
});

// Identifica el tipo de recurso dentro del iframe (IV o CP)
function identifyResourceType(iframeDocument) {
    if (iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-interactive-video')) {
        console.log("Recurso INTERACTIVE VIDEO");
        return 'IV';
    } 
    else if (iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-course-presentation')) {
        console.log("Recurso COURSE PRESENTATION");
        return 'CP';
    }
    return null;
}



// FUNCIONES DEL COURSE PRESENTATION ------------------------------------------>

// Inicializar el recurso CP e identificar y procesar diapositivas relevantes
function initializeCoursePresentation(iframeDocument) {

    // Agregar estilos exclusivos del CP
    addSubtitleStylesForCP(iframeDocument);

    // Seleccionar el contenedor principal del CP
    const coursePresentationElement = iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-course-presentation');
    if (!coursePresentationElement) {
        console.warn("[initializeCoursePresentation] Contenedor del CP no encontrado.");
        return;
    }

    // Identificar diapositivas dentro del CP
    const slides = coursePresentationElement.querySelectorAll('.h5p-slide');
    const slideCount = slides.length;

    if (slideCount > 0) {
        console.log(`[initializeCoursePresentation] Número de diapositivas encontradas: ${slideCount}`);
        slides.forEach((slide, index) => {
            const videoWithVTT = findVideoAndVTTInSlideForCP(slide, index);
            if (videoWithVTT) {
                console.log(`[initializeCoursePresentation] Diapositiva con video y VTT: Índice ${index}`);
                setupFlexboxForCPSlide(slide, videoWithVTT.videoElement, videoWithVTT.trackElement, iframeDocument);
            }
        });
    } else {
        console.warn("[initializeCoursePresentation] No se encontraron diapositivas en el CP.");
    }
}

// Buscar video y archivo VTT en una diapositiva específica del CP
function findVideoAndVTTInSlideForCP(slide, slideIndex) {
    const videoElement = slide.querySelector('video');
    if (videoElement) {
        const trackElement = videoElement.querySelector('track[src$=".vtt"]');
        if (trackElement) {
            return { videoElement, trackElement };
        }
    }
    return null;
}

// Configurar contenedor flexbox para diapositivas específicas del CP con VTT
function setupFlexboxForCPSlide(slide, videoElement, trackElement, iframeDocument) {
    // Crear contenedor principal de flexbox
    const flexContainer = iframeDocument.createElement('div');
    flexContainer.classList.add('flex-container');

    // Crear secciones A (video) y B (subtítulos)
    const sectionA = iframeDocument.createElement('div');
    sectionA.classList.add('section-a');
    const sectionB = iframeDocument.createElement('div');
    sectionB.classList.add('section-b');

    // Añadir el video a la sección A
    sectionA.appendChild(videoElement);

    // Inicializar subtítulos
    if (trackElement.src) {
        fetch(trackElement.src)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(vttContent => {
                if (vttContent) {
                    const captions = processVTTForCP(vttContent);
                    formatCaptionsForCP(sectionB, captions);
                    addTimeUpdateEventForCP(videoElement, captions, sectionB);
                } else {
                    throw new Error("El archivo VTT está vacío.");
                }
            })
            .catch(error => {
                console.error(`[setupFlexboxForCPSlide] Error al cargar archivo VTT: ${error.message}`);
                sectionB.textContent = "No se pudo cargar el archivo VTT.";
            });
    } else {
        console.warn("[setupFlexboxForCPSlide] Archivo VTT no encontrado.");
        sectionB.textContent = "Archivo VTT no disponible.";
    }

    // Agregar botón de mostrar/ocultar transcripción
    addTranscriptToggleButton(iframeDocument, sectionA, sectionB);

    // Añadir secciones al contenedor flexbox
    flexContainer.appendChild(sectionA);
    flexContainer.appendChild(sectionB);

    // Reemplazar el contenido de la diapositiva con el nuevo contenedor flexbox
    slide.innerHTML = '';
    slide.appendChild(flexContainer);
}

// Procesar archivo VTT para subtítulos del CP
function processVTTForCP(vttContent) {
    const lines = vttContent.split('\n');
    const captions = [];
    let currentCaption = null;

    lines.forEach(line => {
        if (line.includes('-->')) {
            if (currentCaption) captions.push(currentCaption);
            const [start, end] = line.split(' --> ');
            currentCaption = { start: parseTimeForCP(start), end: parseTimeForCP(end), text: '' };
        } else if (line.trim() && currentCaption) {
            currentCaption.text += line.trim() + ' ';
        }
    });

    if (currentCaption) captions.push(currentCaption);
    return captions;
}

// Convertir tiempo VTT a segundos para subtítulos del CP
function parseTimeForCP(timeString) {
    const parts = timeString.split(':');
    const seconds = parseFloat(parts[2]);
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + seconds;
}

// Formatear subtítulos y mostrarlos en sectionB para el CP
function formatCaptionsForCP(sectionB, captions) {
    sectionB.innerHTML = '';
    const iframeDocument = sectionB.ownerDocument;
    const videoElement = iframeDocument.querySelector('video');
    
    if (!videoElement) {
        console.warn("[formatCaptionsForCP] No se encontró el elemento <video> en el iframe.");
        return;
    }

    captions.forEach((caption, index) => {
        const listItem = document.createElement('div');
        listItem.classList.add('list-item');
        listItem.id = `caption-${index}`;
        
        // Crear columna de tiempo
        const timeColumn = document.createElement('div');
        timeColumn.classList.add('time-column');
        timeColumn.textContent = formatTimeForCP(caption.start);
        
        // Crear columna de texto del subtítulo
        const textColumn = document.createElement('div');
        textColumn.classList.add('text-column');
        textColumn.textContent = caption.text.replace(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-\d+)/gi, '').trim();
        
        // Añadir las columnas al elemento de la lista
        listItem.append(timeColumn, textColumn);
        sectionB.appendChild(listItem);

        // Añadir funcionalidad de clic para saltar al tiempo del subtítulo
        listItem.addEventListener('click', () => {
            videoElement.currentTime = caption.start;
            videoElement.play();
        });
    });
}

// Formato de tiempo (mm:ss) para subtítulos del CP
function formatTimeForCP(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Sincroniza subtítulos con el video en el CP y centra el subtítulo resaltado
function addTimeUpdateEventForCP(videoElement, captions, sectionB) {
    videoElement.addEventListener('timeupdate', () => {
        const currentTime = videoElement.currentTime;
        captions.forEach((caption, index) => {
            const captionElement = sectionB.querySelector(`#caption-${index}`);
            if (captionElement) {
                if (currentTime >= caption.start && currentTime <= caption.end) {
                    captionElement.classList.add('highlighted');

                    // Centrar el subtítulo resaltado en el contenedor
                    sectionB.scrollTo({
                        top: captionElement.offsetTop - sectionB.clientHeight / 2 + captionElement.clientHeight / 2,
                        behavior: 'smooth'
                    });
                } else {
                    captionElement.classList.remove('highlighted');
                }
            } else {
                console.warn(`[addTimeUpdateEventForCP] Subtítulo con índice ${index} no encontrado.`);
            }
        });
    });
}

// Estilos para los subtítulos del CP
function addSubtitleStylesForCP(iframeDocument) {
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
            height: 100%;
            /* Eliminado el box-sizing para flex-container */
        }
        .section-a {
            flex: 8;
            background-color: #f0f0f0;
            box-sizing: border-box;
            padding: 10px;
            position: relative;
            z-index: 1;
        }
        .section-b {
            flex: 4;
            display: flex;
            flex-direction: column; /* Disposición vertical para subtítulos */
            height: 100%; /* Asegura que ocupe toda la altura disponible */
            overflow-y: auto;
            padding: 10px;
            box-sizing: border-box;
            background-color: #f9f9f9;
        }
        .list-item {
            display: flex; /* Alineación en fila para tiempo y texto */
            align-items: center;
            margin-bottom: 8px;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            background-color: #fff;
            transition: background-color 0.2s ease-in-out;
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
            font-size: 14px;
            font-weight: bold;
            color: #0078d4;
            margin-right: 8px; /* Espaciado entre columnas */
        }
        .text-column {
            flex: 5;
            font-size: 14px;
            color: #333;
            text-align: justify;
        }

        /* Estilos responsivos para pantallas pequeñas */
        @media (max-width: 768px) {
            .flex-container {
                flex-direction: column; /* Cambia a diseño vertical */
            }
            .section-a {
                flex: none; /* Anula la proporción flexible */
                width: 100%;
                height: auto;
            }
            .section-b {
                flex: none; /* Anula la proporción flexible */
                width: 100%;
                height: auto;
                margin-top: 10px;
            }
            .list-item {
                flex-direction: column; /* Cambia a disposición vertical en pantallas pequeñas */
                align-items: flex-start; /* Alinea los elementos al inicio */
            }
            .time-column {
                margin-bottom: 4px; /* Espaciado entre tiempo y texto */
            }
        }
    `;
    iframeDocument.head.appendChild(style);
}

// Sincroniza subtítulos con el video en el CP y centra el subtítulo resaltado
function addTimeUpdateEventForCP(videoElement, captions, sectionB) {
    videoElement.addEventListener('timeupdate', () => {
        const currentTime = videoElement.currentTime;
        captions.forEach((caption, index) => {
            const captionElement = sectionB.querySelector(`#caption-${index}`);
            if (captionElement) {
                if (currentTime >= caption.start && currentTime <= caption.end) {
                    captionElement.classList.add('highlighted');

                    // Centrar el subtítulo resaltado en el contenedor
                    sectionB.scrollTo({
                        top: captionElement.offsetTop - sectionB.clientHeight / 2 + captionElement.clientHeight / 2,
                        behavior: 'smooth'
                    });
                } else {
                    captionElement.classList.remove('highlighted');
                }
            } else {
                console.warn(`[addTimeUpdateEventForCP] Subtítulo con índice ${index} no encontrado.`);
            }
        });
    });
}

// Crear un botón para mostrar/ocultar la transcripción
function addTranscriptToggleButton(iframeDocument, sectionA, sectionB) {
    const footerRight = iframeDocument.querySelector('.h5p-footer-right-adjusted');
    if (!footerRight) {
        console.warn("[addTranscriptToggleButton] No se encontró el contenedor '.h5p-footer-right-adjusted'.");
        return;
    }

    const toggleButton = iframeDocument.createElement('button');
    toggleButton.textContent = "Mostrar/Ocultar Transcripción";
    toggleButton.style.cssText = `
        background-color: #0078d4;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 8px;
    `;

    // Alternar visibilidad de la transcripción
    toggleButton.addEventListener('click', () => {
        const isHidden = sectionB.style.display === 'none';
        sectionB.style.display = isHidden ? 'block' : 'none';
        toggleButton.textContent = isHidden ? "Ocultar Transcripción" : "Mostrar Transcripción";
    });

    // Mostrar inicialmente la transcripción
    sectionB.style.display = 'block';
    toggleButton.textContent = "Ocultar Transcripción";

    // Añadir el botón al pie de página
    footerRight.appendChild(toggleButton);
}

// Crear o actualizar el botón de transcripción y controles de tamaño de fuente
function createOrUpdateTranscriptControls(iframeDocument) {
    console.log("[createOrUpdateTranscriptControls] Iniciando creación de controles.");
    const footerRight = iframeDocument.querySelector('.h5p-footer-right-adjusted');
    if (!footerRight) {
        console.warn("[createOrUpdateTranscriptControls] No se encontró el contenedor '.h5p-footer-right-adjusted'.");
        return null;
    }

    let toggleButton = footerRight.querySelector('#transcript-toggle-button');
    if (!toggleButton) {
        console.log("[createOrUpdateTranscriptControls] Creando botón de transcripción.");
        toggleButton = iframeDocument.createElement('button');
        toggleButton.id = 'transcript-toggle-button';
        toggleButton.textContent = "Mostrar/Ocultar Transcripción";
        toggleButton.style.cssText = `
            background-color: #0078d4;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 8px;
        `;
        toggleButton.disabled = true; // Deshabilitado por defecto
        footerRight.appendChild(toggleButton);
    } else {
        console.log("[createOrUpdateTranscriptControls] Botón de transcripción ya existe.");
    }

    let fontControls = footerRight.querySelector('.font-controls');
    if (!fontControls) {
        console.log("[createOrUpdateTranscriptControls] Creando controles de tamaño de fuente.");
        fontControls = iframeDocument.createElement('div');
        fontControls.classList.add('font-controls');
        fontControls.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px;';

        const increaseFontButton = iframeDocument.createElement('button');
        increaseFontButton.textContent = "+";
        increaseFontButton.style.cssText = `
            background-color: #0078d4;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 4px;
        `;

        const decreaseFontButton = iframeDocument.createElement('button');
        decreaseFontButton.textContent = "-";
        decreaseFontButton.style.cssText = `
            background-color: #0078d4;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 14px;
        `;

        fontControls.appendChild(increaseFontButton);
        fontControls.appendChild(decreaseFontButton);
        footerRight.appendChild(fontControls);

        // Eventos de ajuste de tamaño de fuente
        let currentFontSize = 16; // Tamaño inicial
        const minFontSize = 10;
        const maxFontSize = 34;

        const adjustFontSize = (increment) => {
            console.log(`[adjustFontSize] Ajustando tamaño de fuente: Incremento: ${increment}`);
            currentFontSize = Math.max(minFontSize, Math.min(maxFontSize, currentFontSize + increment));
            const sectionB = iframeDocument.querySelector('.section-b');
            if (sectionB) {
                sectionB.style.fontSize = `${currentFontSize}px`;
                sectionB.querySelectorAll('.time-column, .text-column').forEach((element) => {
                    element.style.fontSize = `${currentFontSize}px`;
                });
                console.log(`[adjustFontSize] Nuevo tamaño de fuente: ${currentFontSize}px.`);
            } else {
                console.warn("[adjustFontSize] No se encontró el contenedor de subtítulos '.section-b'.");
            }
        };

        increaseFontButton.addEventListener('click', () => adjustFontSize(2));
        decreaseFontButton.addEventListener('click', () => adjustFontSize(-2));
    } else {
        console.log("[createOrUpdateTranscriptControls] Controles de tamaño de fuente ya existen.");
    }

    return toggleButton;
}

// Gestionar el estado del botón al cambiar de diapositiva
function updateTranscriptButtonStateWithControls(iframeDocument) {
    console.log("[updateTranscriptButtonStateWithControls] Iniciando actualización del botón.");
    const coursePresentation = iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-course-presentation');
    const toggleButton = iframeDocument.querySelector('#transcript-toggle-button');
    if (!coursePresentation) {
        console.warn("[updateTranscriptButtonStateWithControls] Contenedor de presentación no encontrado.");
        return;
    }
    if (!toggleButton) {
        console.warn("[updateTranscriptButtonStateWithControls] Botón de transcripción no encontrado.");
        return;
    }

    // Detectar cambios de diapositiva
    const observer = new MutationObserver(() => {
        const currentSlide = coursePresentation.querySelector('.h5p-slide.h5p-current-slide');
        if (currentSlide) {
            console.log("[updateTranscriptButtonStateWithControls] Detectando cambio de diapositiva.");
            const hasVTT = currentSlide.querySelector('track[src$=".vtt"]') !== null;

            // Habilitar o deshabilitar el botón
            toggleButton.disabled = !hasVTT;
            toggleButton.style.display = hasVTT ? 'inline-block' : 'none';
            console.log(`[updateTranscriptButtonStateWithControls] Botón ${(hasVTT ? 'habilitado' : 'deshabilitado')}.`);

            if (hasVTT) {
                const sectionB = iframeDocument.querySelector('.section-b');
                toggleButton.onclick = () => {
                    console.log("[updateTranscriptButtonStateWithControls] Botón de transcripción clicado.");
                    const isHidden = sectionB && sectionB.style.display === 'none';
                    if (sectionB) sectionB.style.display = isHidden ? 'block' : 'none';
                    toggleButton.textContent = isHidden ? "Ocultar Transcripción" : "Mostrar Transcripción";
                };
            }
        }
    });

    observer.observe(coursePresentation, { childList: true, subtree: true });
    console.log("[updateTranscriptButtonStateWithControls] Observador de cambios configurado.");
}

// Inicializar el recurso Course Presentation
function initializeCoursePresentationWithControls(iframeDocument) {
    console.log("[initializeCoursePresentationWithControls] Inicializando presentación de curso.");
    // Agregar estilos
    addSubtitleStylesForCP(iframeDocument);

    const coursePresentationElement = iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-course-presentation');
    if (!coursePresentationElement) {
        console.warn("[initializeCoursePresentationWithControls] Contenedor del CP no encontrado.");
        return;
    }

    // Procesar diapositivas
    const slides = coursePresentationElement.querySelectorAll('.h5p-slide');
    slides.forEach((slide, index) => {
        console.log(`[initializeCoursePresentationWithControls] Procesando diapositiva: Índice ${index}`);
        const videoWithVTT = findVideoAndVTTInSlideForCP(slide, index);
        slide.setAttribute('data-has-vtt', videoWithVTT ? 'true' : 'false');

        if (videoWithVTT) {
            console.log(`[initializeCoursePresentationWithControls] Diapositiva ${index} contiene subtítulos VTT.`);
            setupFlexboxForCPSlide(slide, videoWithVTT.videoElement, videoWithVTT.trackElement, iframeDocument);
        } else {
            console.log(`[initializeCoursePresentationWithControls] Diapositiva ${index} sin subtítulos.`);
        }
    });

    // Crear controles de transcripción y tamaño de fuente
    createOrUpdateTranscriptControls(iframeDocument);
    updateTranscriptButtonStateWithControls(iframeDocument);
}






//FUNCIONES DEL INTERACTIVE VIDEO --------------------------------------------->

// Inicializa el Interactive Video
function initializeInteractiveVideo(iframeDocument) {
    addSubtitleStyles(iframeDocument);

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
        setupSubtitleMenu(iframeDocument, sectionA, sectionB);
    } else {
        console.warn("No se pudieron inicializar elementos del Interactive Video.");
    }
}

// Inicializar y personlizar el menú de subtítulos en el IV
function setupSubtitleMenu(iframeDocument, sectionA, sectionB) {

    const controlsContainer = iframeDocument.querySelector('.h5p-controls');
    if (!controlsContainer) {
        console.error('[setupSubtitleMenu] Contenedor de controles no encontrado.');
        return;
    }

    const observer = new MutationObserver(() => {

        const captionsButton = controlsContainer.querySelector('.h5p-control.h5p-captions');
        if (captionsButton) {

            observer.disconnect(); 
            captionsButton.click(); 

            const checkMenu = setInterval(() => {
                const captionsMenu = iframeDocument.querySelector('.h5p-chooser.h5p-captions ol');
                if (captionsMenu) {
                    clearInterval(checkMenu); // Detenemos el intervalo
                    createTranscriptionAndFontSizeOptions(iframeDocument, captionsMenu, sectionA, sectionB);
                } else {
                    console.warn('[setupSubtitleMenu] Menú de subtítulos no encontrado. Intentando nuevamente...');
                }
            }, 500);
        }
    });

    observer.observe(controlsContainer, { childList: true, subtree: true });
}

// Identifica el contenedor de video y el elemento <track> dentro del iframe H5P
function identifyVideoAndTrackElements(iframeDocument) {
    const interactiveVideoContainer = iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-interactive-video');
    const trackElement = iframeDocument.querySelector('track');

    if (!interactiveVideoContainer) {
        console.warn('[identifyVideoAndTrackElements] Contenedor de video no encontrado.');
    }

    if (!trackElement) {
        console.warn('[identifyVideoAndTrackElements] Elemento <track> no encontrado.');
    }

    return (interactiveVideoContainer && trackElement) 
        ? { interactiveVideoContainer, trackElement } 
        : null;
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

    const isMobile = window.innerWidth <= 768;
    const videoElement = sectionA.querySelector('video');

    if (isMobile && videoElement) {
        const videoHeight = videoElement.clientHeight || 0;
        sectionA.style.height = isVisible ? `${videoHeight}px` : '100%';
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

                // Aquí se centra el scroll para mostrar el subtítulo actual
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
            position: relative; /* Asegura que sectionA tenga contexto para posicionamiento */
            z-index: 1; /* Aparece encima */
        }
        .section-b {
            width: 33.33%;
            box-sizing: border-box;
            background: #FFFFFF;
            padding: 10px;
            overflow-y: auto;
            display: none; /* Oculto por defecto */
            position: relative; /* Evita que se superponga */
            z-index: 0; /* Aparece debajo */
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
                flex-direction: column; /* Cambiar a dirección vertical */
            }
            .section-a {
                width: 100%;
                height: auto; /* Se ajusta al contenido del video */
            }
            .section-b {
                width: 100%;
                height: auto;
                display: block; /* Asegura visibilidad */
                margin-top: 10px; /* Espaciado para evitar solapamiento */
            }
        }
    `;
    iframeDocument.head.appendChild(style);
}

// Función de configuración para pantalla completa
function setupFullscreenBehavior(iframeDocument, sectionA, sectionB) {
    const observer = new MutationObserver(() => {
        const fullscreenButton = iframeDocument.querySelector('.h5p-control.h5p-fullscreen');
        const mainContainer = iframeDocument.querySelector('#main-flex-container');
        const flexContainer = iframeDocument.querySelector('.flex-container');

        if (fullscreenButton && mainContainer && flexContainer) {
            observer.disconnect();

            fullscreenButton.addEventListener('click', () => {
                const isFullscreen = !!document.fullscreenElement || !!iframeDocument.fullscreenElement;

                if (!isFullscreen) {
                    if (mainContainer.requestFullscreen) {
                        // Intenta activar pantalla completa
                        mainContainer.requestFullscreen().catch(err => {
                            console.warn("[setupFullscreenBehavior] Error al activar pantalla completa:", err);
                        });
                    } else {
                        console.warn("[setupFullscreenBehavior] requestFullscreen no está soportado.");
                        applyFullscreenFallback(mainContainer, sectionA, sectionB);
                    }
                } else {
                    if (document.exitFullscreen) {
                        // Intenta salir de pantalla completa
                        document.exitFullscreen().catch(err => {
                            console.warn("[setupFullscreenBehavior] Error al salir de pantalla completa:", err);
                        });
                    } else {
                        console.warn("[setupFullscreenBehavior] exitFullscreen no está soportado.");
                        removeFullscreenFallback(mainContainer, sectionA, sectionB);
                    }
                }
                adjustSectionBHeight(sectionA, sectionB, !isFullscreen);
            });

            window.addEventListener('resize', () => {
                const isFullscreen = !!document.fullscreenElement || !!iframeDocument.fullscreenElement;
                adjustSectionBHeight(sectionA, sectionB, isFullscreen);
            });

            document.addEventListener('fullscreenchange', () => {
                const isFullscreen = !!document.fullscreenElement || !!iframeDocument.fullscreenElement;
                if (!isFullscreen) {
                    mainContainer.style.width = '';
                    mainContainer.style.height = '';
                    mainContainer.style.display = '';
                    flexContainer.style.height = '';
                }
                adjustSectionBHeight(sectionA, sectionB, isFullscreen);
            });
        } else {
        }
    });

    observer.observe(iframeDocument.body, { childList: true, subtree: true });
}

// Simulación de activación de pantalla completa con CSS
function applyFullscreenFallback(mainContainer, sectionA, sectionB) {
    console.log("[applyFullscreenFallback] Activando fallback de pantalla completa.");
    mainContainer.style.position = 'fixed';
    mainContainer.style.top = '0';
    mainContainer.style.left = '0';
    mainContainer.style.width = '100vw';
    mainContainer.style.height = '100vh';
    mainContainer.style.zIndex = '9999';
    sectionA.style.height = '70%';
    sectionB.style.height = '30%';
}

// Simulación dedesactivación de pantalla completa 
function removeFullscreenFallback(mainContainer, sectionA, sectionB) {
    console.log("[removeFullscreenFallback] Desactivando fallback de pantalla completa.");
    mainContainer.style.position = '';
    mainContainer.style.top = '';
    mainContainer.style.left = '';
    mainContainer.style.width = '';
    mainContainer.style.height = '';
    mainContainer.style.zIndex = '';
    sectionA.style.height = '';
    sectionB.style.height = '';
}

// Ajuste dinámico de la altura de la sectionA
function adjustSectionAHeightToVideo(sectionA) {
    const videoElement = sectionA.querySelector('video');
    if (videoElement) {
        const videoHeight = videoElement.clientHeight || videoElement.offsetHeight;
        sectionA.style.height = `${videoHeight}px`;
    } else {
        console.warn('[adjustSectionAHeightToVideo] Elemento <video> no encontrado en sectionA.');
    }
}

// Ajusta dinámicamente las alturas para vista móvil, escritorio y pantalla completa
function adjustSectionBHeight(sectionA, sectionB, isFullscreen = false) {
    const isMobile = window.innerWidth <= 768;

    if (isFullscreen) {
        sectionA.style.height = isMobile ? '70%' : '80%';
        sectionB.style.height = isMobile ? '30%' : '20%';
    } else if (isMobile) {
        sectionA.style.height = '60%';
        sectionB.style.height = '40%';
    } else {
        const sectionAHeight = sectionA.clientHeight;
        sectionB.style.height = `${sectionAHeight}px`;
    }
}
