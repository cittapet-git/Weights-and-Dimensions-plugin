jQuery(document).ready(function($) {
    // Configuración del servidor de mediciones
    const MEASUREMENT_SERVER = {
        host: '192.168.1.100',
        endpoints: {
            weight: '/weight',
            dimension: '/dimension'
        }
    };
    
    const barcodeInput = $('#pdm-barcode-input');
    const productInfo = $('.pdm-product-info');
    const suggestions = $('.pdm-suggestions');
    const spinner = $('.pdm-spinner');
    
    let lastKeyTime = 0;
    let barcodeBuffer = '';
    const BARCODE_DELAY = 50;
    let isScanning = false; // Nueva variable para controlar si estamos en proceso de escaneo

    // Variables para control de medición secuencial
    let currentMeasurement = null;
    const measurementSequence = ['weight', 'length', 'width', 'height'];
    let isMeasuring = false;
    let cycleCompleted = false;

    // Escuchar eventos de teclado en todo el documento
    $(document).on('keypress', function(e) {
        const currentTime = new Date().getTime();
        
        // Si el tiempo entre teclas es muy corto, probablemente sea un scanner
        if (currentTime - lastKeyTime <= BARCODE_DELAY) {
            isScanning = true; // Marcamos que estamos en proceso de escaneo
            // No agregar el Enter al buffer
            if (e.which !== 13) {
                barcodeBuffer += e.key;
            }
        } else {
            barcodeBuffer = '';
            isScanning = false; // No es entrada de scanner
            if (e.which !== 13) {
                barcodeBuffer += e.key;
            }
        }
        
        lastKeyTime = currentTime;

        // Si detectamos un enter y tenemos datos en el buffer
        if (e.which === 13 && barcodeBuffer.length > 0) {
            // Si hay una medición en curso, detenerla
            if (isMeasuring) {
                $('.stop-measure-btn:visible').click();
                currentMeasurement = null;
            }
            
            searchProducts(barcodeBuffer, true);
            barcodeInput.val(barcodeBuffer);
            barcodeBuffer = '';
            e.preventDefault();
            
            // Limpiar el flag de escaneo después de un breve delay
            setTimeout(() => {
                isScanning = false;
            }, 100);
        }
    });

    function searchProducts(search, isScanner = false) {
        spinner.show();
        suggestions.hide();
        
        $.ajax({
            url: pdm_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pdm_search_product',
                nonce: pdm_ajax.nonce,
                search: search
            },
            success: function(response) {
                spinner.hide();
                if (response.success && response.data.length > 0) {
                    if (isScanner) {
                        displayProduct(response.data[0]);
                        barcodeInput.val(response.data[0].sku);
                    } else {
                        displaySuggestions(response.data);
                    }
                } else {
                    if (isScanner) {
                        alert('Producto no encontrado');
                        productInfo.hide();
                    } else {
                        suggestions.html('<div class="pdm-suggestion-item">No se encontraron productos</div>').show();
                    }
                }
            },
            error: function() {
                spinner.hide();
                alert('Error al buscar productos');
            }
        });
    }

    // Mantener la búsqueda manual en el input
    barcodeInput.on('keyup', function(e) {
        const search = $(this).val();
        
        // Si no es una entrada de scanner, realizar búsqueda normal
        if (e.which !== 13) {
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                searchProducts(search, false);
            }, 300);
        }
    });
    
    function displaySuggestions(products) {
        suggestions.empty();
        
        products.forEach(product => {
            const item = $(`
                <div class="pdm-suggestion-item" data-product='${JSON.stringify(product)}'>
                    <img src="${product.image || ''}" alt="${product.title}">
                    <div class="pdm-suggestion-info">
                        <div class="pdm-suggestion-title">${product.title}</div>
                        <div class="pdm-suggestion-meta">${product.meta}</div>
                    </div>
                </div>
            `);
            
            suggestions.append(item);
        });
        
        suggestions.show();
    }
    
    function selectFirstSuggestion() {
        const firstItem = suggestions.find('.pdm-suggestion-item').first();
        if (firstItem.length) {
            firstItem.click();
        }
    }
    
    $(document).on('click', '.pdm-suggestion-item', function() {
        const product = $(this).data('product');
        if (product) {
            displayProduct(product);
            suggestions.hide();
            barcodeInput.val(product.sku);
        }
    });
    
    // Cerrar sugerencias al hacer clic fuera
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.pdm-search-section').length) {
            suggestions.hide();
        }
    });
    
    function displayProduct(product) {
        $('#pdm-product-image').attr('src', product.image);
        $('#pdm-product-title').text(product.title);
        $('#pdm-product-sku').text(product.sku);
        $('#pdm-weight').val(product.weight);
        $('#pdm-length').val(product.length);
        $('#pdm-width').val(product.width);
        $('#pdm-height').val(product.height);
        
        // Resetear las variables de control al mostrar un nuevo producto
        currentMeasurement = null;
        isMeasuring = false;
        cycleCompleted = false;
        
        productInfo.show();
    }
    
    $('.pdm-save-all').on('click', function() {
        const productId = $('#pdm-product-sku').data('product-id');
        const data = {
            weight: $('#pdm-weight').val(),
            length: $('#pdm-length').val(),
            width: $('#pdm-width').val(),
            height: $('#pdm-height').val()
        };
        
        // Por ahora solo mostrar los datos que se guardarían
        console.log('Saving data:', data);
        alert('Save functionality will be implemented here');
    });

    // Función para obtener el peso de la balanza
    async function getWeight() {
        const weightUrl = `http://${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.weight}`;
        console.log('Iniciando petición de peso a', weightUrl);
        try {
            const response = await fetch(weightUrl);
            console.log('Respuesta del servidor de peso:', response);
            const data = await response.json();
            console.log('Datos de peso recibidos:', data);
            console.log('Peso extraído:', data.peso_kg);
            return data.peso_kg;
        } catch (error) {
            console.error('Error detallado al obtener el peso:', {
                message: error.message,
                error: error
            });
            throw error;
        }
    }

    // Función para obtener dimensiones
    async function getDimension() {
        const dimensionUrl = `http://${MEASUREMENT_SERVER.host}${MEASUREMENT_SERVER.endpoints.dimension}`;
        console.log('Iniciando petición de dimensión a', dimensionUrl);
        try {
            const response = await fetch(dimensionUrl);
            console.log('Respuesta del servidor de dimensiones:', response);
            const data = await response.json();
            console.log('Datos de dimensión recibidos:', data);
            console.log('Dimensión extraída:', data.dimension_cm);
            return data.dimension_cm;
        } catch (error) {
            console.error('Error detallado al obtener la dimensión:', {
                message: error.message,
                error: error
            });
            throw error;
        }
    }

    // Variables para controlar las mediciones continuas
    let measurementInterval = null;
    const MEASUREMENT_DELAY = 250; // 250ms entre mediciones

    // Función modificada para obtener el peso continuamente
    async function startContinuousWeight($input, $measureBtn, $stopBtn) {
        try {
            const weight = await getWeight();
            $input.val(weight);
            
            // Programar la siguiente medición si el intervalo sigue activo
            if (measurementInterval) {
                setTimeout(() => startContinuousWeight($input, $measureBtn, $stopBtn), MEASUREMENT_DELAY);
            }
        } catch (error) {
            console.error('Error en medición continua de peso:', error);
            stopMeasurement($measureBtn, $stopBtn);
            alert(`Error al obtener la medición: ${error.message}`);
        }
    }

    // Función modificada para obtener dimensiones continuamente
    async function startContinuousDimension($input, $measureBtn, $stopBtn) {
        try {
            const dimension = await getDimension();
            $input.val(dimension);
            
            // Programar la siguiente medición si el intervalo sigue activo
            if (measurementInterval) {
                setTimeout(() => startContinuousDimension($input, $measureBtn, $stopBtn), MEASUREMENT_DELAY);
            }
        } catch (error) {
            console.error('Error en medición continua de dimensión:', error);
            stopMeasurement($measureBtn, $stopBtn);
            alert(`Error al obtener la medición: ${error.message}`);
        }
    }

    // Función para detener las mediciones
    function stopMeasurement($measureBtn, $stopBtn) {
        measurementInterval = null;
        $measureBtn.removeClass('loading');
        $stopBtn.hide();
        $measureBtn.show();
        isMeasuring = false;
        
        // Si esta es la última medición, marcar el ciclo como completado
        if (currentMeasurement === 'height') {
            currentMeasurement = null;
            cycleCompleted = true;
        }
    }

    // Modificar el manejador de clicks en los botones de medición
    $('.measure-btn').on('click', function() {
        const $button = $(this);
        const $input = $button.prev('input');
        const $stopBtn = $button.nextAll('.stop-measure-btn').first();
        const measureType = $button.data('type');
        
        console.log('Iniciando medición continua:', measureType);
        
        // Mostrar botón de detener y ocultar botón de medición
        $button.hide();
        $stopBtn.show();
        
        // Iniciar medición continua
        measurementInterval = true;
        $button.addClass('loading');
        
        if (measureType === 'weight') {
            startContinuousWeight($input, $button, $stopBtn);
        } else {
            startContinuousDimension($input, $button, $stopBtn);
        }
    });

    // Manejador para el botón de detener
    $('.stop-measure-btn').on('click', function() {
        const $stopBtn = $(this);
        const $measureBtn = $stopBtn.prevAll('.measure-btn').first();
        stopMeasurement($measureBtn, $stopBtn);
    });

    // Agregar tooltips a los botones de medición
    $('.measure-btn').each(function() {
        const type = $(this).data('type');
        const title = type === 'weight' ? 'Obtener peso de la balanza' : `Obtener ${type} del detector`;
        $(this).attr('title', title);
    });

    // Función para iniciar la siguiente medición en la secuencia
    function startNextMeasurement() {
        // Si el ciclo está completo, no hacer nada
        if (cycleCompleted) {
            console.log('Ciclo completado, no se pueden iniciar más mediciones');
            return;
        }

        // Si estamos midiendo, detener la medición actual y avanzar
        if (isMeasuring) {
            $('.stop-measure-btn:visible').click();
            
            // Si acabamos de detener la última medición, no continuar
            if (cycleCompleted) {
                return;
            }
            
            // Avanzar al siguiente en la secuencia
            const currentIndex = measurementSequence.indexOf(currentMeasurement);
            currentMeasurement = measurementSequence[currentIndex + 1];
            return;
        }

        // Si no estamos midiendo, iniciar la medición actual o la primera
        if (!currentMeasurement) {
            currentMeasurement = 'weight';
        }

        // Encontrar el botón correspondiente y simular el click
        const $measureBtn = $(`.measure-btn[data-type="${currentMeasurement}"]`);
        $measureBtn.click();
        isMeasuring = true;
    }

    // Manejador de teclas para todo el documento
    $(document).on('keydown', function(e) {
        // Ignorar el Enter si viene del scanner
        if (isScanning) return;

        // Solo procesar si hay un producto seleccionado
        if (!productInfo.is(':visible')) return;

        if (e.key === ' ') { // Barra espaciadora
            e.preventDefault(); // Prevenir scroll
            startNextMeasurement();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            
            // Si hay una medición en curso, detenerla
            if (isMeasuring) {
                $('.stop-measure-btn:visible').click();
            }
            
            // Simular click en el botón de guardar
            $('.pdm-save-all').click();
        }
    });
}); 