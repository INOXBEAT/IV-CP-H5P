// Función para inicializar el recurso CP e identificar las diapositivas
function initializeCoursePresentation(iframeDocument) {
    console.log("[initializeCoursePresentation] Inicializando Course Presentation.");

    const coursePresentationElement = iframeDocument.querySelector('.h5p-container.h5p-standalone.h5p-course-presentation');

    if (!coursePresentationElement) {
        console.warn("[initializeCoursePresentation] Contenedor del CP no encontrado.");
        return;
    }

    const slides = coursePresentationElement.querySelectorAll('.h5p-slide');
    const slideCount = slides.length;

    if (slideCount > 0) {
        console.log(`[initializeCoursePresentation] Número de diapositivas encontradas: ${slideCount}`);

        // Llamar a la función para buscar diapositivas con video y VTT
        const slideWithVTT = findSlideWithVideoAndVTT(slides);
        if (slideWithVTT) {
            console.log(`[initializeCoursePresentation] Diapositiva con video y VTT encontrada en el índice: ${slideWithVTT.slideIndex}`);
        } else {
            console.warn("[initializeCoursePresentation] No se encontraron diapositivas con video y archivo VTT.");
        }
    } else {
        console.warn("[initializeCoursePresentation] No se encontraron diapositivas en el CP.");
    }
}
