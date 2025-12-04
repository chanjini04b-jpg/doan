// 브라우저 확장 프로그램 오류 무시
window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('message channel closed')) {
        e.preventDefault();
        return true;
    }
});

// 페이지 로드 후 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 컬러링 도안 생성기 시작!');
    
    // 전역 변수
    let currentImage = null;
    
    // DOM 요소
    const fileInput = document.getElementById('fileInput');
    const searchInput = document.getElementById('searchInput');
    const naverSearchButton = document.getElementById('naverSearchButton');
    const googleSearchButton = document.getElementById('googleSearchButton');
    const settingsSection = document.getElementById('settingsSection');
    const resultSection = document.getElementById('resultSection');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // 설정 요소
    const edgeThreshold = document.getElementById('edgeThreshold');
    const edgeValue = document.getElementById('edgeValue');
    const lineWidth = document.getElementById('lineWidth');
    const lineValue = document.getElementById('lineValue');
    const blurAmount = document.getElementById('blurAmount');
    const blurValue = document.getElementById('blurValue');
    const contrast = document.getElementById('contrast');
    const contrastValue = document.getElementById('contrastValue');
    const invertColors = document.getElementById('invertColors');
    const autoEnhance = document.getElementById('autoEnhance');
    const detailLevel = document.getElementById('detailLevel');
    const drawingMode = document.getElementById('drawingMode');

    // 버튼
    const generateButton = document.getElementById('generateButton');
    const downloadPdfButton = document.getElementById('downloadPdfButton');
    const downloadImageButton = document.getElementById('downloadImageButton');
    const resetButton = document.getElementById('resetButton');
    
    // 편집 도구 요소
    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    const drawColor = document.getElementById('drawColor');
    const undoButton = document.getElementById('undoButton');
    const redoButton = document.getElementById('redoButton');
    const clearEditsButton = document.getElementById('clearEditsButton');
    
    // 추천 관련 요소
    const recommendationSection = document.getElementById('recommendationSection');
    const recommendationResult = document.getElementById('recommendationResult');
    
    // 추천 설정값 저장 변수
    let recommendedSettings = null;
    
    // 편집 관련 변수
    let isDrawing = false;
    let currentTool = 'draw'; // 'draw', 'erase', 'line', 'rect-select'
    let currentCanvas = null; // 현재 그리는 캔버스
    let selectionStart = null;
    let selectionPath = [];
    let tempCanvas = null; // 선택 영역 미리보기용
    let editHistory = [];
    let historyStep = -1;
    let lineStartX = null;
    let lineStartY = null;
    let originalColoringPage = null; // 원본 도안 저장용
    
    console.log('✅ 모든 DOM 요소 로드 완료');

    // ========== 탭 전환 기능 ==========
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            button.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    // ========== 파일 업로드 기능 ==========
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });

    // 전체 페이지에 드래그 앤 드롭 기능
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFileSelect(file);
        }
    });

    // ========== 클립보드에서 이미지 붙여넣기 기능 ==========
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        // 클립보드 아이템 중 이미지 찾기
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                
                // Blob을 Data URL로 변환
                const reader = new FileReader();
                reader.onload = (event) => {
                    loadImage(event.target.result);
                    console.log('✅ 클립보드에서 이미지 붙여넣기 완료');
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });

    function handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('이미지 파일을 선택해주세요.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            loadImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    // ========== 이미지 로드 함수 ==========
    function loadImage(src) {
        console.log('📷 이미지 로드 시작');
        
        // 기존 캔버스 초기화
        const originalCanvas = document.getElementById('originalCanvas');
        const resultCanvas = document.getElementById('resultCanvas');
        if (originalCanvas) {
            const ctx = originalCanvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
            originalCanvas.width = 0;
            originalCanvas.height = 0;
        }
        if (resultCanvas) {
            const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
            resultCanvas.width = 0;
            resultCanvas.height = 0;
        }
        
        // 편집 히스토리 초기화
        editHistory = [];
        historyStep = -1;
        
        // 결과 섹션 비활성화
        resultSection.classList.add('disabled');
        
        console.log('✅ 기존 캔버스 및 히스토리 초기화 완료');
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            console.log('✅ 이미지 로드 성공:', img.width, 'x', img.height);
            currentImage = img;
            
            // 미리보기 이미지 표시
            showPreviewImage(src);
            
            // 설정 섹션 활성화
            settingsSection.classList.remove('disabled');
            
            // 부드럽게 스크롤
            setTimeout(() => {
                settingsSection.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        };
        
        img.onerror = () => {
            console.error('❌ 이미지 로드 실패');
            alert('이미지를 불러올 수 없습니다.');
        };
        
        img.src = src;
    }

    // ========== 미리보기 이미지 표시 함수 ==========
    function showPreviewImage(src) {
        // 업로드 탭 미리보기
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPreviewImage = document.getElementById('uploadPreviewImage');
        const uploadPrompt = document.getElementById('uploadPrompt');
        
        // 검색 탭 미리보기
        const searchPreview = document.getElementById('searchPreview');
        const searchPreviewImage = document.getElementById('searchPreviewImage');
        const searchPrompt = document.getElementById('searchPrompt');
        
        // 현재 활성화된 탭 확인
        const uploadTab = document.getElementById('upload-tab');
        const searchTab = document.getElementById('search-tab');
        
        if (uploadTab.classList.contains('active')) {
            // 업로드 탭에서 붙여넣기
            if (uploadPreviewImage) uploadPreviewImage.src = src;
            if (uploadPreview) uploadPreview.style.display = 'block';
            if (uploadPrompt) uploadPrompt.style.display = 'none';
        } else if (searchTab.classList.contains('active')) {
            // 검색 탭에서 붙여넣기
            if (searchPreviewImage) searchPreviewImage.src = src;
            if (searchPreview) searchPreview.style.display = 'block';
            if (searchPrompt) searchPrompt.style.display = 'none';
        }
    }

    // ========== 네이버/구글 이미지 검색 기능 ==========
    let naverSearchWindow = null;
    let googleSearchWindow = null;
    
    naverSearchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }
        // 네이버 이미지 검색 - 같은 창 재사용
        const naverUrl = `https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(query)}`;
        if (naverSearchWindow && !naverSearchWindow.closed) {
            naverSearchWindow.location.href = naverUrl;
            naverSearchWindow.focus();
        } else {
            naverSearchWindow = window.open(naverUrl, 'NaverImageSearch');
        }
    });

    googleSearchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }
        // 구글 이미지 검색 - 같은 창 재사용
        const googleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
        if (googleSearchWindow && !googleSearchWindow.closed) {
            googleSearchWindow.location.href = googleUrl;
            googleSearchWindow.focus();
        } else {
            googleSearchWindow = window.open(googleUrl, 'GoogleImageSearch');
        }
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            naverSearchButton.click();
        }
    });



    // ========== 설정 슬라이더 업데이트 ==========
    let autoRegenerateTimeout = null;
    
    // 실시간 자동 재생성 함수
    function autoRegenerate() {
        // 도안이 한 번이라도 생성된 경우에만 자동 재생성
        if (!currentImage || resultSection.classList.contains('disabled')) {
            return;
        }
        
        // 이전 타이머 취소
        if (autoRegenerateTimeout) {
            clearTimeout(autoRegenerateTimeout);
        }
        
        // 500ms 후 재생성 (사용자가 슬라이더 조정 중일 때 과도한 재생성 방지)
        autoRegenerateTimeout = setTimeout(() => {
            console.log('🔄 설정 변경 감지 - 자동 재생성 중...');
            try {
                generateColoringPage();
            } catch (error) {
                console.error('자동 재생성 오류:', error);
            }
        }, 500);
    }
    
    edgeThreshold.addEventListener('input', () => {
        edgeValue.textContent = edgeThreshold.value;
        autoRegenerate();
    });

    lineWidth.addEventListener('input', () => {
        lineValue.textContent = lineWidth.value;
        autoRegenerate();
    });

    blurAmount.addEventListener('input', () => {
        blurValue.textContent = blurAmount.value;
        autoRegenerate();
    });

    contrast.addEventListener('input', () => {
        contrastValue.textContent = contrast.value;
        autoRegenerate();
    });
    
    // 체크박스와 셀렉트도 실시간 적용
    invertColors.addEventListener('change', () => {
        autoRegenerate();
    });
    
    autoEnhance.addEventListener('change', () => {
        autoRegenerate();
    });
    
    detailLevel.addEventListener('change', () => {
        autoRegenerate();
    });
    
    drawingMode.addEventListener('change', () => {
        console.log('🎨 도안 스타일 변경:', drawingMode.value);
        autoRegenerate();
    });

    // ========== 추천 설정 자동 적용 함수 ==========
    function applyRecommendedSettings(settings) {
        if (!settings) return;
        
        edgeThreshold.value = settings.threshold;
        edgeValue.textContent = settings.threshold;
        
        lineWidth.value = settings.lineWidth;
        lineValue.textContent = settings.lineWidth;
        
        blurAmount.value = settings.blur;
        blurValue.textContent = settings.blur;
        
        contrast.value = settings.contrast;
        contrastValue.textContent = settings.contrast;
        
        detailLevel.value = settings.detailLevel;
        autoEnhance.checked = settings.autoEnhance;
        
        console.log('✅ 추천 설정 적용됨:', settings);
    }

    // ========== AI 분석 후 도안 생성 버튼 (통합) ==========
    generateButton.addEventListener('click', () => {
        console.log('🎨 AI 분석 후 도안 생성 버튼 클릭!');
        
        if (!currentImage) {
            alert('이미지를 먼저 선택해주세요.');
            return;
        }
        
        showLoading();
        
        setTimeout(() => {
            try {
                // 1단계: AI 분석
                console.log('🔍 AI 이미지 분석 중...');
                const analysis = analyzeImage(currentImage);
                displayRecommendation(analysis);
                
                // 2단계: 추천 설정 자동 적용
                console.log('✨ 추천 설정 자동 적용...');
                applyRecommendedSettings(analysis.recommendedSettings);
                
                // 3단계: 도안 생성
                console.log('🎨 도안 생성 중...');
                generateColoringPage();
                
                hideLoading();
                resultSection.classList.remove('disabled');
                resultSection.scrollIntoView({ behavior: 'smooth' });
                console.log('✅ 도안 생성 완료!');
            } catch (error) {
                console.error('❌ 도안 생성 오류:', error);
                hideLoading();
                alert('도안 생성 중 오류가 발생했습니다: ' + error.message);
            }
        }, 500);
    });

    // ========== 컬러링 도안 생성 함수 (혁신적인 버전) ==========
    function generateColoringPage() {
        console.log('🚀 컬러링 도안 생성 시작!');
        
        if (!currentImage) {
            alert('먼저 이미지를 업로드하거나 붙여넣어주세요.');
            return;
        }
        
        // 캔버스 요소 가져오기
        const originalCanvas = document.getElementById('originalCanvas');
        const resultCanvas = document.getElementById('resultCanvas');
        const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
        const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
        
        // 캔버스 크기 설정
        const maxSize = 600;
        let width, height;
        let isFirstLoad = false;
        
        // 원본 캔버스가 이미 설정되어 있고 내용이 있으면 그대로 사용 (편집 내용 유지)
        if (originalCanvas.width > 0 && originalCanvas.height > 0) {
            // 캔버스에 실제 내용이 있는지 확인
            const imageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
            const hasContent = imageData.data.some((value, index) => {
                // 알파 채널(투명도)이 0이 아닌 픽셀이 있는지 확인
                return index % 4 === 3 && value > 0;
            });
            
            if (hasContent) {
                width = originalCanvas.width;
                height = originalCanvas.height;
                console.log('✅ 기존 원본 캔버스 사용 (편집 내용 유지):', width, 'x', height);
            } else {
                isFirstLoad = true;
            }
        } else {
            isFirstLoad = true;
        }
        
        // 처음 로드하는 경우에만 크기 계산 및 이미지 그리기
        if (isFirstLoad) {
            width = currentImage.width;
            height = currentImage.height;
            
            if (width > height && width > maxSize) {
                height = Math.floor((height * maxSize) / width);
                width = maxSize;
            } else if (height > maxSize) {
                width = Math.floor((width * maxSize) / height);
                height = maxSize;
            }
            
            originalCanvas.width = width;
            originalCanvas.height = height;
            
            // 원본 이미지 그리기
            originalCtx.drawImage(currentImage, 0, 0, width, height);
            console.log('✅ 원본 이미지 그리기 완료:', width, 'x', height);
        }
        
        resultCanvas.width = width;
        resultCanvas.height = height;
        
        // 설정값 가져오기
        const threshold = parseInt(edgeThreshold.value);
        const lineThick = parseFloat(lineWidth.value);
        const blur = parseInt(blurAmount.value);
        const contrastVal = parseInt(contrast.value) / 100;
        const invert = invertColors.checked;
        const enhance = autoEnhance.checked;
        const detail = detailLevel.value;
        const mode = drawingMode.value; // 'coloring' 또는 'silhouette'
        
        console.log('⚙️ 설정:', { threshold, lineThick, blur, contrastVal, detail, mode });
        
        // 이미지 데이터 추출
        let imageData = originalCtx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // 0단계: 그림자 제거 전처리 (어두운 이미지 개선)
        console.log('☀️ 그림자 제거 및 밝기 정규화 중...');
        removeShadowsAndNormalize(imageData.data);
        
        // 1단계: 블러 적용 (노이즈 제거)
        if (blur > 0) {
            console.log('🔵 블러 적용 중...');
            for (let i = 0; i < blur; i++) {
                imageData = applyBoxBlur(imageData, width, height);
            }
        }
        
        // 2단계: CLAHE (Contrast Limited Adaptive Histogram Equalization) 적용
        console.log('🔆 적응형 히스토그램 균등화 중...');
        applyCLAHE(imageData.data, width, height);
        
        // 3단계: 대비 조정
        if (enhance) {
            console.log('🔆 자동 대비 조정 중...');
            enhanceContrast(imageData.data, contrastVal);
        }
        
        // 4단계: 그레이스케일 변환
        console.log('⚫ 그레이스케일 변환 중...');
        const grayData = convertToGrayscale(imageData.data);
        
        // 5단계: 엣지 검출 (개선된 알고리즘)
        console.log('🔍 엣지 검출 중 (디테일:', detail, ')...');
        const edges = detectEdges(grayData, width, height, detail);
        
        let binary;
        
        if (mode === 'silhouette') {
            // 누끼/실루엣 모드: 외곽선만 추출
            console.log('✂️ 누끼 모드: 외곽선 추출 중...');
            binary = extractSilhouetteOutline(grayData, width, height, threshold);
        } else if (mode === 'sketch') {
            // 연필 스케치 모드: 부드러운 그레이스케일 스케치
            console.log('✏️ 연필 스케치 모드: 스케치 생성 중...');
            binary = createPencilSketch(grayData, width, height, threshold);
        } else {
            // 컬러링북 모드: 상세 엣지
            // 6단계: 적응형 이진화 (지역별 임계값 적용)
            console.log('⬛ 적응형 이진화 처리 중...');
            binary = adaptiveBinarize(edges, grayData, width, height, threshold);
            
            // 8단계: 실루엣 개선 및 노이즈 제거
            console.log('✨ 실루엣 정제 중...');
            refineSilhouette(binary, width, height);
        }
        
        // 7단계: 선 두께 조정 (sketch 모드는 제외)
        if (mode !== 'sketch') {
            if (lineThick > 0.5) {
                console.log('✏️ 선 두께 조정 중:', lineThick);
                thickenLines(binary, width, height, lineThick);
            } else if (lineThick < 1 && mode === 'silhouette') {
                // 누끼 모드에서 0.5 미만일 때 선을 더 얇게
                console.log('✏️ 선 얇게 조정 중:', lineThick);
                thinLines(binary, width, height, lineThick);
            }
        }
        
        // 9단계: 결과 생성
        console.log('🎨 최종 결과 생성 중...');
        const resultData = resultCtx.createImageData(width, height);
        const result = resultData.data;
        
        for (let i = 0; i < binary.length; i++) {
            const value = invert ? (binary[i] === 0 ? 255 : 0) : binary[i];
            result[i * 4] = value;
            result[i * 4 + 1] = value;
            result[i * 4 + 2] = value;
            result[i * 4 + 3] = 255;
        }
        
        // 캔버스에 그리기
        resultCtx.putImageData(resultData, 0, 0);
        
        // 원본 도안 저장 (편집용)
        originalColoringPage = resultCanvas.toDataURL();
        
        // 편집 히스토리 초기화
        editHistory = [originalColoringPage];
        historyStep = 0;
        
        // 편집 도구 초기화 (최초 1회만)
        if (!resultCanvas.hasEditTools) {
            initEditTools();
            resultCanvas.hasEditTools = true;
        }
        
        console.log('✅ 컬러링 도안 생성 완료!');
    }

    // ========== 이미지 처리 함수들 ==========
    
    // 그림자 제거 및 밝기 정규화 (어두운 이미지 개선)
    function removeShadowsAndNormalize(data) {
        // 1. 밝기 히스토그램 계산
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            const brightness = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[brightness]++;
        }
        
        // 2. 누적 히스토그램 계산
        const cumulativeHist = new Array(256);
        cumulativeHist[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cumulativeHist[i] = cumulativeHist[i - 1] + histogram[i];
        }
        
        // 3. 1%와 99% 백분위수 찾기 (극단값 제거)
        const totalPixels = data.length / 4;
        const minPercentile = totalPixels * 0.01;
        const maxPercentile = totalPixels * 0.99;
        
        let minValue = 0, maxValue = 255;
        for (let i = 0; i < 256; i++) {
            if (cumulativeHist[i] >= minPercentile) {
                minValue = i;
                break;
            }
        }
        for (let i = 255; i >= 0; i--) {
            if (cumulativeHist[i] <= maxPercentile) {
                maxValue = i;
                break;
            }
        }
        
        // 4. 밝기 정규화 적용 (그림자 제거)
        const range = Math.max(1, maxValue - minValue);
        for (let i = 0; i < data.length; i += 4) {
            for (let j = 0; j < 3; j++) {
                let value = data[i + j];
                // 밝기 스트레칭
                value = ((value - minValue) / range) * 255;
                // 감마 보정 (어두운 영역 밝게)
                value = Math.pow(value / 255, 0.8) * 255;
                data[i + j] = Math.min(255, Math.max(0, value));
            }
        }
    }
    
    // CLAHE (Contrast Limited Adaptive Histogram Equalization)
    function applyCLAHE(data, width, height, clipLimit = 2.0, tileSize = 8) {
        const tilesX = Math.ceil(width / tileSize);
        const tilesY = Math.ceil(height / tileSize);
        
        // 각 타일별로 히스토그램 균등화 적용
        for (let ty = 0; ty < tilesY; ty++) {
            for (let tx = 0; tx < tilesX; tx++) {
                const x1 = tx * tileSize;
                const y1 = ty * tileSize;
                const x2 = Math.min(x1 + tileSize, width);
                const y2 = Math.min(y1 + tileSize, height);
                
                // 타일 영역의 히스토그램 계산
                const histogram = new Array(256).fill(0);
                for (let y = y1; y < y2; y++) {
                    for (let x = x1; x < x2; x++) {
                        const idx = (y * width + x) * 4;
                        const brightness = Math.floor(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
                        histogram[brightness]++;
                    }
                }
                
                // Clip 적용 (과도한 대비 제한)
                const tilePixels = (x2 - x1) * (y2 - y1);
                const clipValue = (clipLimit * tilePixels) / 256;
                let clippedSum = 0;
                
                for (let i = 0; i < 256; i++) {
                    if (histogram[i] > clipValue) {
                        clippedSum += histogram[i] - clipValue;
                        histogram[i] = clipValue;
                    }
                }
                
                // 클리핑된 값 재분배
                const redistribution = clippedSum / 256;
                for (let i = 0; i < 256; i++) {
                    histogram[i] += redistribution;
                }
                
                // 누적 분포 함수 생성
                const cdf = new Array(256);
                cdf[0] = histogram[0];
                for (let i = 1; i < 256; i++) {
                    cdf[i] = cdf[i - 1] + histogram[i];
                }
                
                // 정규화
                const cdfMin = cdf.find(v => v > 0) || 0;
                const cdfRange = tilePixels - cdfMin;
                
                // 타일 영역에 균등화 적용
                for (let y = y1; y < y2; y++) {
                    for (let x = x1; x < x2; x++) {
                        const idx = (y * width + x) * 4;
                        const brightness = Math.floor(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
                        
                        // 균등화된 밝기 계산
                        const newBrightness = ((cdf[brightness] - cdfMin) / cdfRange) * 255;
                        const ratio = newBrightness / Math.max(1, brightness);
                        
                        // RGB 채널에 비율 적용
                        for (let j = 0; j < 3; j++) {
                            data[idx + j] = Math.min(255, Math.max(0, data[idx + j] * ratio));
                        }
                    }
                }
            }
        }
    }
    
    // 적응형 이진화 (윤곽선만 추출)
    function adaptiveBinarize(edges, grayData, width, height, globalThreshold) {
        const binary = new Uint8ClampedArray(edges.length);
        binary.fill(255); // 기본값: 모두 흰색
        
        // 1. 엣지 강도 기반 임계값 계산
        const edgeValues = Array.from(edges).filter(v => v > 0).sort((a, b) => a - b);
        const percentile90 = edgeValues[Math.floor(edgeValues.length * 0.9)] || 100;
        
        // 2. 동적 임계값 설정 (사용자 설정 반영)
        const dynamicThreshold = Math.max(30, Math.min(150, percentile90 * (globalThreshold / 50)));
        
        console.log('🎯 동적 임계값:', dynamicThreshold.toFixed(1));
        
        // 3. 엣지만 검출 (강한 엣지만 선으로 표시)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const edgeStrength = edges[idx];
                
                // 강한 엣지만 윤곽선으로 인식
                if (edgeStrength > dynamicThreshold) {
                    binary[idx] = 0; // 검은색 (윤곽선)
                }
            }
        }
        
        return binary;
    }
    
    // 윤곽선 정제 (노이즈 제거 및 선 연결)
    function refineSilhouette(binary, width, height) {
        // 1. 고립된 점 제거 (노이즈 제거)
        const temp = new Uint8ClampedArray(binary);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                if (temp[idx] === 0) { // 검은 점(선)이면
                    // 주변 8방향 검사
                    let blackNeighbors = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            if (temp[(y + dy) * width + (x + dx)] === 0) {
                                blackNeighbors++;
                            }
                        }
                    }
                    
                    // 완전히 고립된 점만 제거 (선의 연결성 유지)
                    if (blackNeighbors === 0) {
                        binary[idx] = 255;
                    }
                }
            }
        }
        
        // 2. 끊어진 선 연결 (가까운 선끼리 연결)
        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {
                const idx = y * width + x;
                
                if (binary[idx] === 255) { // 흰 점이면
                    // 대각선 방향으로 선이 끊어진 경우 연결
                    const hasTopLeft = binary[(y-1) * width + (x-1)] === 0;
                    const hasBottomRight = binary[(y+1) * width + (x+1)] === 0;
                    const hasTopRight = binary[(y-1) * width + (x+1)] === 0;
                    const hasBottomLeft = binary[(y+1) * width + (x-1)] === 0;
                    
                    // 대각선으로 선이 있으면 연결
                    if ((hasTopLeft && hasBottomRight) || (hasTopRight && hasBottomLeft)) {
                        binary[idx] = 0;
                    }
                }
            }
        }
    }
    
    // 이미지 분석 및 추천 함수
    function analyzeImage(image) {
        console.log('🔍 이미지 분석 시작...');
        
        // 임시 캔버스 생성
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // 분석을 위한 작은 크기로 리샘플링 (성능 향상)
        const maxAnalysisSize = 400;
        let width = image.width;
        let height = image.height;
        
        if (width > height && width > maxAnalysisSize) {
            height = Math.floor((height * maxAnalysisSize) / width);
            width = maxAnalysisSize;
        } else if (height > maxAnalysisSize) {
            width = Math.floor((width * maxAnalysisSize) / height);
            height = maxAnalysisSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // 1. 복잡도 분석 (엣지 밀도)
        const grayData = convertToGrayscale(data);
        const edges = detectEdges(grayData, width, height, 'medium');
        
        let edgePixels = 0;
        for (let i = 0; i < edges.length; i++) {
            if (edges[i] > 50) edgePixels++;
        }
        const edgeDensity = (edgePixels / edges.length) * 100;
        
        // 2. 명암 대비 분석
        let minBrightness = 255, maxBrightness = 0;
        let totalBrightness = 0;
        
        for (let i = 0; i < grayData.length; i++) {
            const brightness = grayData[i];
            minBrightness = Math.min(minBrightness, brightness);
            maxBrightness = Math.max(maxBrightness, brightness);
            totalBrightness += brightness;
        }
        
        const avgBrightness = totalBrightness / grayData.length;
        const contrastRange = maxBrightness - minBrightness;
        
        // 3. 색상 다양성 분석
        const colorMap = new Map();
        for (let i = 0; i < data.length; i += 4) {
            const color = `${Math.floor(data[i]/32)},${Math.floor(data[i+1]/32)},${Math.floor(data[i+2]/32)}`;
            colorMap.set(color, (colorMap.get(color) || 0) + 1);
        }
        const colorDiversity = colorMap.size;
        
        // 4. 노이즈 레벨 분석
        let noiseLevel = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const current = grayData[idx];
                const neighbors = [
                    grayData[idx - 1], grayData[idx + 1],
                    grayData[idx - width], grayData[idx + width]
                ];
                const variance = neighbors.reduce((sum, n) => sum + Math.abs(current - n), 0) / 4;
                noiseLevel += variance;
            }
        }
        noiseLevel = noiseLevel / ((width - 2) * (height - 2));
        
        // 5. 디테일 레벨 판단
        let detailLevel;
        if (edgeDensity < 10) {
            detailLevel = 'low';
        } else if (edgeDensity > 25) {
            detailLevel = 'high';
        } else {
            detailLevel = 'medium';
        }
        
        // 6. 이미지 타입 추정
        let imageType;
        if (colorDiversity < 200) {
            imageType = '단순 일러스트';
        } else if (colorDiversity > 800) {
            imageType = '복잡한 사진';
        } else if (edgeDensity < 15) {
            imageType = '심플한 그림';
        } else {
            imageType = '일반 이미지';
        }
        
        console.log('📊 분석 결과:', {
            edgeDensity: edgeDensity.toFixed(2),
            contrastRange,
            avgBrightness: avgBrightness.toFixed(2),
            colorDiversity,
            noiseLevel: noiseLevel.toFixed(2),
            detailLevel,
            imageType
        });
        
        // 7. 최적 설정 추천
        let threshold, lineWidthVal, blur, contrastVal, autoEnhanceVal;
        
        // 복잡도에 따른 임계값 조정
        if (edgeDensity < 10) {
            threshold = 30; // 단순한 이미지 - 낮은 임계값
        } else if (edgeDensity > 25) {
            threshold = 70; // 복잡한 이미지 - 높은 임계값
        } else {
            threshold = 50;
        }
        
        // 노이즈에 따른 블러 조정
        if (noiseLevel > 20) {
            blur = 4;
        } else if (noiseLevel > 10) {
            blur = 2;
        } else {
            blur = 1;
        }
        
        // 대비에 따른 조정
        if (contrastRange < 100) {
            contrastVal = 120; // 대비 강화
            autoEnhanceVal = true;
        } else if (contrastRange > 200) {
            contrastVal = 80; // 대비 완화
            autoEnhanceVal = false;
        } else {
            contrastVal = 100;
            autoEnhanceVal = true;
        }
        
        // 선 두께 추천 (얇은 선 중심으로 조정)
        if (detailLevel === 'low') {
            lineWidthVal = 2.5;
        } else if (detailLevel === 'high') {
            lineWidthVal = 0.8;
        } else {
            lineWidthVal = 1.5;
        }
        
        return {
            // 분석 정보
            edgeDensity: edgeDensity.toFixed(1),
            complexity: edgeDensity < 10 ? '낮음' : edgeDensity > 25 ? '높음' : '보통',
            contrastRange: contrastRange,
            brightness: avgBrightness.toFixed(0),
            colorDiversity: colorDiversity,
            noiseLevel: noiseLevel.toFixed(1),
            imageType: imageType,
            detailLevel: detailLevel,
            
            // 추천 설정
            recommendedSettings: {
                threshold: threshold,
                lineWidth: lineWidthVal,
                blur: blur,
                contrast: contrastVal,
                detailLevel: detailLevel,
                autoEnhance: autoEnhanceVal
            }
        };
    }
    
    // 추천 결과 표시
    function displayRecommendation(analysis) {
        const detailLevelText = {
            'low': '낮음 (단순한 도안)',
            'medium': '보통 (일반 도안)',
            'high': '높음 (상세한 도안)'
        };
        
        recommendationResult.innerHTML = `
            <div class="analysis-info">
                <div class="info-card">
                    <div class="info-label">이미지 타입</div>
                    <div class="info-value">${analysis.imageType}</div>
                </div>
                <div class="info-card">
                    <div class="info-label">복잡도</div>
                    <div class="info-value">${analysis.complexity}</div>
                </div>
                <div class="info-card">
                    <div class="info-label">엣지 밀도</div>
                    <div class="info-value">${analysis.edgeDensity}%</div>
                </div>
                <div class="info-card">
                    <div class="info-label">노이즈 레벨</div>
                    <div class="info-value">${analysis.noiseLevel}</div>
                </div>
            </div>
            
            <div class="recommendation-settings">
                <h4>💡 추천 설정</h4>
                <div class="settings-list">
                    <div class="setting-recommendation">
                        <span class="setting-name">윤곽선 감도</span>
                        <span class="setting-value">${analysis.recommendedSettings.threshold}</span>
                    </div>
                    <div class="setting-recommendation">
                        <span class="setting-name">선 두께</span>
                        <span class="setting-value">${analysis.recommendedSettings.lineWidth}</span>
                    </div>
                    <div class="setting-recommendation">
                        <span class="setting-name">부드러움</span>
                        <span class="setting-value">${analysis.recommendedSettings.blur}</span>
                    </div>
                    <div class="setting-recommendation">
                        <span class="setting-name">명암 대비</span>
                        <span class="setting-value">${analysis.recommendedSettings.contrast}</span>
                    </div>
                    <div class="setting-recommendation">
                        <span class="setting-name">디테일 레벨</span>
                        <span class="setting-value">${detailLevelText[analysis.recommendedSettings.detailLevel]}</span>
                    </div>
                    <div class="setting-recommendation">
                        <span class="setting-name">자동 품질 향상</span>
                        <span class="setting-value">${analysis.recommendedSettings.autoEnhance ? 'ON' : 'OFF'}</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px; text-align: center;">
                <strong>✅ 위 설정이 자동으로 적용되어 도안이 생성되었습니다!</strong>
            </div>
        `;
        
        // 추천 설정 저장
        recommendedSettings = analysis.recommendedSettings;
        
        console.log('✅ 추천 완료!');
    }
    
    // 박스 블러
    function applyBoxBlur(imageData, width, height) {
        const data = imageData.data;
        const output = new Uint8ClampedArray(data.length);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let r = 0, g = 0, b = 0;
                
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        r += data[idx];
                        g += data[idx + 1];
                        b += data[idx + 2];
                    }
                }
                
                const idx = (y * width + x) * 4;
                output[idx] = r / 9;
                output[idx + 1] = g / 9;
                output[idx + 2] = b / 9;
                output[idx + 3] = 255;
            }
        }
        
        return new ImageData(output, width, height);
    }
    
    // 대비 향상
    function enhanceContrast(data, factor) {
        for (let i = 0; i < data.length; i += 4) {
            for (let j = 0; j < 3; j++) {
                const value = data[i + j];
                data[i + j] = Math.min(255, Math.max(0, (value - 128) * factor + 128));
            }
        }
    }
    
    // 그레이스케일 변환
    function convertToGrayscale(data) {
        const gray = new Uint8ClampedArray(data.length / 4);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = Math.floor(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        }
        return gray;
    }
    
    // 엣지 검출 (개선된 Sobel 필터)
    function detectEdges(gray, width, height, detail) {
        const edges = new Uint8ClampedArray(gray.length);
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * width + (x + kx);
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);
                        const pixel = gray[idx];
                        
                        gx += pixel * sobelX[kernelIdx];
                        gy += pixel * sobelY[kernelIdx];
                    }
                }
                
                let magnitude = Math.sqrt(gx * gx + gy * gy);
                
                // 디테일 레벨에 따라 가중치 조정
                if (detail === 'low') {
                    magnitude *= 0.6; // 단순한 윤곽선만
                } else if (detail === 'high') {
                    magnitude *= 1.5; // 세밀한 윤곽선
                } else {
                    magnitude *= 1.0; // 보통
                }
                
                // Non-maximum suppression (얇은 윤곽선 유지)
                const angle = Math.atan2(gy, gx);
                const angleDeg = (angle * 180 / Math.PI + 180) % 180;
                
                let isMax = true;
                if (angleDeg < 22.5 || angleDeg >= 157.5) {
                    // 수평 엣지
                    const prev = Math.sqrt(Math.pow(gray[(y-1) * width + x] * sobelX[1], 2));
                    const next = Math.sqrt(Math.pow(gray[(y+1) * width + x] * sobelX[1], 2));
                    isMax = magnitude >= prev && magnitude >= next;
                } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
                    // 수직 엣지
                    const prev = Math.sqrt(Math.pow(gray[y * width + (x-1)] * sobelY[3], 2));
                    const next = Math.sqrt(Math.pow(gray[y * width + (x+1)] * sobelY[5], 2));
                    isMax = magnitude >= prev && magnitude >= next;
                }
                
                edges[y * width + x] = isMax ? Math.min(255, magnitude) : 0;
            }
        }
        
        return edges;
    }
    
    // 누끼/실루엣 외곽선 추출 함수
    // 연필 스케치 스타일 생성 (수채화에 적합한 부드러운 선)
    function createPencilSketch(grayData, width, height, threshold) {
        const result = new Uint8ClampedArray(width * height);
        
        // 1. Sobel 필터로 엣지 강도 계산
        const edges = new Float32Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                const gx = 
                    -grayData[idx - width - 1] + grayData[idx - width + 1] +
                    -2 * grayData[idx - 1] + 2 * grayData[idx + 1] +
                    -grayData[idx + width - 1] + grayData[idx + width + 1];
                
                const gy = 
                    -grayData[idx - width - 1] - 2 * grayData[idx - width] - grayData[idx - width + 1] +
                    grayData[idx + width - 1] + 2 * grayData[idx + width] + grayData[idx + width + 1];
                
                edges[idx] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        
        // 2. 엣지 강도를 그레이스케일 값으로 변환 (연필 느낌)
        let maxEdge = 0;
        for (let i = 0; i < edges.length; i++) {
            if (edges[i] > maxEdge) maxEdge = edges[i];
        }
        
        for (let i = 0; i < edges.length; i++) {
            // 엣지가 강할수록 어둡게 (연필 선)
            const edgeStrength = edges[i] / maxEdge;
            const pencilValue = 255 - (edgeStrength * 200); // 0~255 범위
            
            // 원본의 명암 정보도 약간 반영 (음영 표현)
            const shadingValue = grayData[i] * 0.7 + 255 * 0.3;
            
            // 둘을 조합하여 연필 스케치 느낌
            result[i] = Math.max(0, Math.min(255, pencilValue * 0.6 + shadingValue * 0.4));
        }
        
        // 3. 가우시안 블러로 부드럽게 (연필의 번짐 효과)
        const blurred = new Uint8ClampedArray(result);
        const kernelSize = 3;
        const sigma = 0.8;
        const kernel = [];
        let kernelSum = 0;
        
        for (let i = -kernelSize; i <= kernelSize; i++) {
            for (let j = -kernelSize; j <= kernelSize; j++) {
                const value = Math.exp(-(i * i + j * j) / (2 * sigma * sigma));
                kernel.push({dx: j, dy: i, weight: value});
                kernelSum += value;
            }
        }
        
        for (let y = kernelSize; y < height - kernelSize; y++) {
            for (let x = kernelSize; x < width - kernelSize; x++) {
                const idx = y * width + x;
                let sum = 0;
                
                for (const k of kernel) {
                    sum += result[idx + k.dy * width + k.dx] * k.weight;
                }
                
                blurred[idx] = sum / kernelSum;
            }
        }
        
        return blurred;
    }
    
    // 연필 스케치 스타일 생성 (수채화에 적합한 부드러운 선)
    function createPencilSketch(grayData, width, height, threshold) {
        const result = new Uint8ClampedArray(width * height);
        
        // 1. Sobel 필터로 엣지 강도 계산
        const edges = new Float32Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                const gx = 
                    -grayData[idx - width - 1] + grayData[idx - width + 1] +
                    -2 * grayData[idx - 1] + 2 * grayData[idx + 1] +
                    -grayData[idx + width - 1] + grayData[idx + width + 1];
                
                const gy = 
                    -grayData[idx - width - 1] - 2 * grayData[idx - width] - grayData[idx - width + 1] +
                    grayData[idx + width - 1] + 2 * grayData[idx + width] + grayData[idx + width + 1];
                
                edges[idx] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        
        // 2. 엣지 강도를 그레이스케일 값으로 변환 (연필 느낌)
        let maxEdge = 0;
        for (let i = 0; i < edges.length; i++) {
            if (edges[i] > maxEdge) maxEdge = edges[i];
        }
        
        for (let i = 0; i < edges.length; i++) {
            // 엣지가 강할수록 어둡게 (연필 선)
            const edgeStrength = edges[i] / maxEdge;
            const pencilValue = 255 - (edgeStrength * 200); // 0~255 범위
            
            // 원본의 명암 정보도 약간 반영 (음영 표현)
            const shadingValue = grayData[i] * 0.7 + 255 * 0.3;
            
            // 둘을 조합하여 연필 스케치 느낌
            result[i] = Math.max(0, Math.min(255, pencilValue * 0.6 + shadingValue * 0.4));
        }
        
        // 3. 가우시안 블러로 부드럽게 (연필의 번짐 효과)
        const blurred = new Uint8ClampedArray(result);
        const kernelSize = 3;
        const sigma = 0.8;
        const kernel = [];
        let kernelSum = 0;
        
        for (let i = -kernelSize; i <= kernelSize; i++) {
            for (let j = -kernelSize; j <= kernelSize; j++) {
                const value = Math.exp(-(i * i + j * j) / (2 * sigma * sigma));
                kernel.push({dx: j, dy: i, weight: value});
                kernelSum += value;
            }
        }
        
        for (let y = kernelSize; y < height - kernelSize; y++) {
            for (let x = kernelSize; x < width - kernelSize; x++) {
                const idx = y * width + x;
                let sum = 0;
                
                for (const k of kernel) {
                    sum += result[idx + k.dy * width + k.dx] * k.weight;
                }
                
                blurred[idx] = sum / kernelSum;
            }
        }
        
        return blurred;
    }
    
    // 연필 스케치 스타일 생성 (수채화에 적합한 부드러운 선)
    function createPencilSketch(grayData, width, height, threshold) {
        const result = new Uint8ClampedArray(width * height);
        
        // 1. Sobel 필터로 엣지 강도 계산
        const edges = new Float32Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                const gx = 
                    -grayData[idx - width - 1] + grayData[idx - width + 1] +
                    -2 * grayData[idx - 1] + 2 * grayData[idx + 1] +
                    -grayData[idx + width - 1] + grayData[idx + width + 1];
                
                const gy = 
                    -grayData[idx - width - 1] - 2 * grayData[idx - width] - grayData[idx - width + 1] +
                    grayData[idx + width - 1] + 2 * grayData[idx + width] + grayData[idx + width + 1];
                
                edges[idx] = Math.sqrt(gx * gx + gy * gy);
            }
        }
        
        // 2. 엣지 강도를 그레이스케일 값으로 변환 (연필 느낌)
        let maxEdge = 0;
        for (let i = 0; i < edges.length; i++) {
            if (edges[i] > maxEdge) maxEdge = edges[i];
        }
        
        for (let i = 0; i < edges.length; i++) {
            // 엣지가 강할수록 어둡게 (연필 선)
            const edgeStrength = edges[i] / maxEdge;
            const pencilValue = 255 - (edgeStrength * 200); // 0~255 범위
            
            // 원본의 명암 정보도 약간 반영 (음영 표현)
            const shadingValue = grayData[i] * 0.7 + 255 * 0.3;
            
            // 둘을 조합하여 연필 스케치 느낌
            result[i] = Math.max(0, Math.min(255, pencilValue * 0.6 + shadingValue * 0.4));
        }
        
        // 3. 가우시안 블러로 부드럽게 (연필의 번짐 효과)
        const blurred = new Uint8ClampedArray(result);
        const kernelSize = 2;
        const sigma = 0.8;
        const kernel = [];
        let kernelSum = 0;
        
        for (let i = -kernelSize; i <= kernelSize; i++) {
            for (let j = -kernelSize; j <= kernelSize; j++) {
                const value = Math.exp(-(i * i + j * j) / (2 * sigma * sigma));
                kernel.push({dx: j, dy: i, weight: value});
                kernelSum += value;
            }
        }
        
        for (let y = kernelSize; y < height - kernelSize; y++) {
            for (let x = kernelSize; x < width - kernelSize; x++) {
                const idx = y * width + x;
                let sum = 0;
                
                for (const k of kernel) {
                    sum += result[idx + k.dy * width + k.dx] * k.weight;
                }
                
                blurred[idx] = sum / kernelSum;
            }
        }
        
        return blurred;
    }
    
    function extractSilhouetteOutline(grayData, width, height, threshold) {
        const binary = new Uint8ClampedArray(width * height).fill(255);
        
        // 1. Sobel 필터로 그래디언트 계산
        const sobelX = new Float32Array(width * height);
        const sobelY = new Float32Array(width * height);
        const magnitude = new Float32Array(width * height);
        const direction = new Float32Array(width * height);
        
        // Sobel 연산자
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Sobel X (수평 엣지)
                const gx = 
                    -grayData[idx - width - 1] + grayData[idx - width + 1] +
                    -2 * grayData[idx - 1] + 2 * grayData[idx + 1] +
                    -grayData[idx + width - 1] + grayData[idx + width + 1];
                
                // Sobel Y (수직 엣지)
                const gy = 
                    -grayData[idx - width - 1] - 2 * grayData[idx - width] - grayData[idx - width + 1] +
                    grayData[idx + width - 1] + 2 * grayData[idx + width] + grayData[idx + width + 1];
                
                sobelX[idx] = gx;
                sobelY[idx] = gy;
                magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
                direction[idx] = Math.atan2(gy, gx);
            }
        }
        
        // 2. Non-maximum suppression - 엣지 방향에 수직으로 가장 강한 픽셀만 유지
        const suppressed = new Float32Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const angle = direction[idx];
                const mag = magnitude[idx];
                
                // 그래디언트 방향의 수직 방향으로 이웃 선택
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                
                // 보간을 사용한 정확한 이웃값 계산
                let mag1, mag2;
                
                if (Math.abs(cos) > Math.abs(sin)) {
                    // 수평에 가까운 경우
                    const sign = cos > 0 ? 1 : -1;
                    const offset = Math.abs(sin / cos);
                    mag1 = magnitude[idx - sign] * (1 - offset) + magnitude[idx - sign - width] * offset;
                    mag2 = magnitude[idx + sign] * (1 - offset) + magnitude[idx + sign + width] * offset;
                } else {
                    // 수직에 가까운 경우
                    const sign = sin > 0 ? 1 : -1;
                    const offset = Math.abs(cos / sin);
                    mag1 = magnitude[idx - sign * width] * (1 - offset) + magnitude[idx - sign * width - 1] * offset;
                    mag2 = magnitude[idx + sign * width] * (1 - offset) + magnitude[idx + sign * width + 1] * offset;
                }
                
                // 양쪽 이웃보다 크거나 같으면 유지
                if (mag >= mag1 && mag >= mag2) {
                    suppressed[idx] = mag;
                }
            }
        }
        
        // 3. 임계값 설정
        let maxMag = 0;
        for (let i = 0; i < suppressed.length; i++) {
            if (suppressed[i] > maxMag) maxMag = suppressed[i];
        }
        
        const highThreshold = Math.max(threshold * 0.3, maxMag * 0.15);
        const lowThreshold = highThreshold * 0.4;
        
        // 4. 이중 임계값 및 엣지 추적
        const visited = new Uint8ClampedArray(width * height);
        
        function traceEdge(startIdx) {
            const stack = [startIdx];
            
            while (stack.length > 0) {
                const idx = stack.pop();
                const y = Math.floor(idx / width);
                const x = idx % width;
                
                if (y < 1 || y >= height - 1 || x < 1 || x >= width - 1) continue;
                if (visited[idx]) continue;
                
                visited[idx] = 1;
                binary[idx] = 0;
                
                // 8방향 이웃 확인
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy === 0 && dx === 0) continue;
                        
                        const neighborIdx = idx + dy * width + dx;
                        
                        if (!visited[neighborIdx] && suppressed[neighborIdx] >= lowThreshold) {
                            stack.push(neighborIdx);
                        }
                    }
                }
            }
        }
        
        // 강한 엣지에서 추적 시작
        for (let i = 0; i < suppressed.length; i++) {
            if (suppressed[i] >= highThreshold && !visited[i]) {
                traceEdge(i);
            }
        }
        
        return binary;
    }
    
    // 이진화
    function binarizeEdges(edges, threshold, width, height) {
        const binary = new Uint8ClampedArray(edges.length);
        
        for (let i = 0; i < edges.length; i++) {
            binary[i] = edges[i] > threshold ? 0 : 255; // 엣지는 검은색(0), 나머지는 흰색(255)
        }
        
        return binary;
    }
    
    // 선 두께 증가
    function thickenLines(binary, width, height, thickness) {
        const temp = new Uint8ClampedArray(binary);
        const radius = thickness / 2; // 소수점 지원
        
        for (let y = Math.ceil(radius); y < height - Math.ceil(radius); y++) {
            for (let x = Math.ceil(radius); x < width - Math.ceil(radius); x++) {
                const idx = y * width + x;
                
                if (temp[idx] === 0) { // 검은색 픽셀이면
                    // 주변을 검은색으로 채우기 (소수점 반경 지원)
                    const startY = Math.floor(-radius);
                    const endY = Math.ceil(radius);
                    const startX = Math.floor(-radius);
                    const endX = Math.ceil(radius);
                    
                    for (let dy = startY; dy <= endY; dy++) {
                        for (let dx = startX; dx <= endX; dx++) {
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            if (distance <= radius) {
                                const targetY = y + dy;
                                const targetX = x + dx;
                                if (targetY >= 0 && targetY < height && targetX >= 0 && targetX < width) {
                                    binary[targetY * width + targetX] = 0;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 선 얇게 만들기 (0.5 미만 두께용)
    function thinLines(binary, width, height, thickness) {
        // thickness가 0.1~0.9 사이일 때 일부 픽셀을 제거하여 더 얇게
        const keepRatio = thickness; // 0.5면 50%만 유지
        const temp = new Uint8ClampedArray(binary);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                if (temp[idx] === 0) { // 검은색 픽셀이면
                    // 주변 검은색 픽셀 개수 확인
                    const neighbors = [
                        temp[idx - 1], temp[idx + 1],
                        temp[idx - width], temp[idx + width],
                        temp[idx - width - 1], temp[idx - width + 1],
                        temp[idx + width - 1], temp[idx + width + 1]
                    ];
                    
                    const blackCount = neighbors.filter(n => n === 0).length;
                    
                    // 양쪽에 검은색이 많으면 (굵은 부분) 일부 제거
                    if (blackCount >= 4) {
                        // thickness에 따라 확률적으로 제거
                        const random = (x * y) % 100 / 100; // 의사 난수
                        if (random > keepRatio) {
                            binary[idx] = 255; // 흰색으로 변경
                        }
                    }
                }
            }
        }
    }

    // ========== PDF 다운로드 ==========
    downloadPdfButton.addEventListener('click', () => {
        const resultCanvas = document.getElementById('resultCanvas');
        if (!resultCanvas || !resultCanvas.width) {
            alert('먼저 컬러링 도안을 생성해주세요.');
            return;
        }
        
        showLoading();
        
        setTimeout(() => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: resultCanvas.width > resultCanvas.height ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // 1페이지: 원본 이미지
            const originalCanvas = document.getElementById('originalCanvas');
            const originalImgData = originalCanvas.toDataURL('image/jpeg', 1.0);
            const originalRatio = Math.min(pdfWidth / originalCanvas.width, pdfHeight / originalCanvas.height);
            const originalWidth = originalCanvas.width * originalRatio * 0.9;
            const originalHeight = originalCanvas.height * originalRatio * 0.9;
            const originalX = (pdfWidth - originalWidth) / 2;
            const originalY = (pdfHeight - originalHeight) / 2;
            
            pdf.addImage(originalImgData, 'JPEG', originalX, originalY, originalWidth, originalHeight);
            pdf.text('원본 이미지', pdfWidth / 2, 10, { align: 'center' });
            
            // 2페이지: 컬러링 도안
            pdf.addPage();
            const resultImgData = resultCanvas.toDataURL('image/jpeg', 1.0);
            const resultRatio = Math.min(pdfWidth / resultCanvas.width, pdfHeight / resultCanvas.height);
            const resultWidth = resultCanvas.width * resultRatio * 0.9;
            const resultHeight = resultCanvas.height * resultRatio * 0.9;
            const resultX = (pdfWidth - resultWidth) / 2;
            const resultY = (pdfHeight - resultHeight) / 2;
            
            pdf.addImage(resultImgData, 'JPEG', resultX, resultY, resultWidth, resultHeight);
            pdf.text('컬러링 도안', pdfWidth / 2, 10, { align: 'center' });
            
            pdf.save('coloring-page.pdf');
            
            hideLoading();
        }, 300);
    });

    // ========== 이미지 다운로드 ==========
    downloadImageButton.addEventListener('click', () => {
        const resultCanvas = document.getElementById('resultCanvas');
        const originalCanvas = document.getElementById('originalCanvas');
        if (!resultCanvas || !resultCanvas.width) {
            alert('먼저 컬러링 도안을 생성해주세요.');
            return;
        }
        
        // 원본과 도안을 결합한 캔버스 생성
        const combinedCanvas = document.createElement('canvas');
        const ctx = combinedCanvas.getContext('2d');
        const gap = 40; // 이미지 사이 간격
        
        combinedCanvas.width = originalCanvas.width + resultCanvas.width + gap;
        combinedCanvas.height = Math.max(originalCanvas.height, resultCanvas.height) + 100; // 제목 공간
        
        // 흰색 배경
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        
        // 제목 추가
        ctx.fillStyle = 'black';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('원본 이미지', originalCanvas.width / 2, 40);
        ctx.fillText('컬러링 도안', originalCanvas.width + gap + resultCanvas.width / 2, 40);
        
        // 원본 이미지
        ctx.drawImage(originalCanvas, 0, 70);
        
        // 컬러링 도안
        ctx.drawImage(resultCanvas, originalCanvas.width + gap, 70);
        
        // 다운로드
        const link = document.createElement('a');
        link.download = 'coloring-page-with-original.png';
        link.href = combinedCanvas.toDataURL('image/png');
        link.click();
    });

    // ========== 인쇄 (라디오 버튼 클릭 시 바로 실행) ==========
    const printRadios = document.querySelectorAll('input[name="printType"]');
    printRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const resultCanvas = document.getElementById('resultCanvas');
            const originalCanvas = document.getElementById('originalCanvas');
            if (!resultCanvas || !resultCanvas.width) {
                alert('먼저 컬러링 도안을 생성해주세요.');
                radio.checked = false;
                return;
            }
            
            const selectedType = radio.value;
            
            let option = '3'; // 기본값: 둘 다
            if (selectedType === 'original') {
                option = '1';
            } else if (selectedType === 'coloring') {
                option = '2';
            }
            
            // 고해상도 이미지로 변환 (더 선명한 인쇄)
            const originalImgData = originalCanvas.toDataURL('image/png', 1.0);
            const resultImgData = resultCanvas.toDataURL('image/png', 1.0);
        
        let htmlContent = '';
        
        if (option === '1') {
            // 원본 이미지만 (세로형)
            htmlContent = `
                <div class="page single">
                    <h2>📷 원본 이미지</h2>
                    <div class="img-container">
                        <img src="${originalImgData}" alt="원본 이미지">
                    </div>
                </div>
            `;
        } else if (option === '2') {
            // 컬러링 도안만 (세로형)
            htmlContent = `
                <div class="page single">
                    <h2>🎨 컬러링 도안</h2>
                    <div class="img-container">
                        <img src="${resultImgData}" alt="컬러링 도안">
                    </div>
                </div>
            `;
        } else {
            // 둘 다 (가로형)
            htmlContent = `
                <div class="page dual">
                    <div class="image-section">
                        <h2>📷 원본 이미지</h2>
                        <div class="img-container">
                            <img src="${originalImgData}" alt="원본 이미지">
                        </div>
                    </div>
                    <div class="image-section">
                        <h2>🎨 컬러링 도안</h2>
                        <div class="img-container">
                            <img src="${resultImgData}" alt="컬러링 도안">
                        </div>
                    </div>
                </div>
            `;
        }
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>컬러링 도안 인쇄</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        @page {
                            size: A4 ${option === '3' ? 'landscape' : 'portrait'};
                            margin: 0;
                        }
                        
                        html, body {
                            width: 100%;
                            height: 100%;
                            margin: 0;
                            padding: 0;
                        }
                        
                        body { 
                            font-family: Arial, sans-serif;
                            background: white;
                        }
                        
                        /* 단일 이미지 (세로형) */
                        .page.single {
                            width: 100vw;
                            height: 100vh;
                            page-break-after: avoid;
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            padding: 15mm;
                        }
                        
                        /* 두 이미지 (가로형) */
                        .page.dual {
                            width: 100vw;
                            height: 100vh;
                            page-break-after: avoid;
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: row;
                            align-items: stretch;
                            justify-content: space-between;
                            padding: 10mm;
                            gap: 5mm;
                        }
                        
                        .image-section {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-width: 0;
                        }
                        
                        h2 {
                            font-size: 12pt;
                            margin-bottom: 3mm;
                            text-align: center;
                            color: #333;
                            flex-shrink: 0;
                        }
                        
                        .page.single h2 {
                            font-size: 16pt;
                            margin-bottom: 8mm;
                        }
                        
                        .img-container {
                            flex: 1;
                            width: 100%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                        }
                        
                        .page.single .img-container {
                            height: calc(100% - 30mm);
                        }
                        
                        img { 
                            max-width: 100%;
                            max-height: 100%;
                            width: auto;
                            height: auto;
                            object-fit: contain;
                            image-rendering: -webkit-optimize-contrast;
                            image-rendering: crisp-edges;
                        }
                        
                        @media print {
                            @page {
                                margin: 0;
                            }
                            
                            html, body {
                                width: 100%;
                                height: 100%;
                                margin: 0;
                                padding: 0;
                            }
                            
                            .page {
                                width: 100%;
                                height: 100%;
                                margin: 0;
                                page-break-after: avoid;
                                page-break-inside: avoid;
                            }
                            
                            .page.single {
                                padding: 12mm;
                            }
                            
                            .page.dual {
                                padding: 8mm;
                            }
                            
                            h2 {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            
                            img {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                        }
                        
                        @media screen {
                            body {
                                padding: 20px;
                                background: #e0e0e0;
                            }
                            .page {
                                margin: 0 auto;
                                background: white;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            }
                            .page.dual {
                                max-width: 297mm;
                                max-height: 210mm;
                            }
                            .page.single {
                                max-width: 210mm;
                                max-height: 297mm;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                    <script>
                        setTimeout(() => window.print(), 500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
        });
    });

    // ========== 초기화 ==========
    resetButton.addEventListener('click', () => {
        currentImage = null;
        fileInput.value = '';
        searchInput.value = '';
        
        // 미리보기 숨기기
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPrompt = document.getElementById('uploadPrompt');
        const searchPreview = document.getElementById('searchPreview');
        const searchPrompt = document.getElementById('searchPrompt');
        
        if (uploadPreview) uploadPreview.style.display = 'none';
        if (uploadPrompt) uploadPrompt.style.display = 'block';
        if (searchPreview) searchPreview.style.display = 'none';
        if (searchPrompt) searchPrompt.style.display = 'block';
        
        // 섹션 비활성화
        settingsSection.classList.add('disabled');
        resultSection.classList.add('disabled');
        
        recommendationResult.innerHTML = '<p style="text-align: center; opacity: 0.8; padding: 20px;">아래 버튼을 클릭하면 AI가 이미지를 분석하여 최적의 설정으로 도안을 자동 생성합니다.</p>';
        recommendedSettings = null;
        
        edgeThreshold.value = 50;
        edgeValue.textContent = '50';
        lineWidth.value = 1.5;
        lineValue.textContent = '1.5';
        blurAmount.value = 2;
        blurValue.textContent = '2';
        contrast.value = 100;
        contrastValue.textContent = '100';
        invertColors.checked = false;
        autoEnhance.checked = true;
        detailLevel.value = 'medium';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ========== CORS 우회 함수 ==========
    function convertImageToDataURL(url, callback) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
                const dataURL = canvas.toDataURL('image/png');
                callback(dataURL);
            } catch (e) {
                console.error('Canvas 데이터 추출 실패:', e);
                callback(null);
            }
        };
        
        img.onerror = function() {
            console.error('이미지 로드 실패:', url);
            callback(null);
        };
        
        img.src = url;
    }

    // ========== 로딩 표시 ==========
    function showLoading() {
        loadingOverlay.classList.add('active');
    }

    function hideLoading() {
        loadingOverlay.classList.remove('active');
    }

    // ========== 캔버스 편집 기능 ==========
    
    // 편집 도구 초기화
    function initEditTools() {
        const resultCanvas = document.getElementById('resultCanvas');
        const originalCanvas = document.getElementById('originalCanvas');
        if (!resultCanvas || !originalCanvas) return;
        
        // 두 캔버스 모두에 편집 도구 적용
        const canvases = [originalCanvas, resultCanvas];
        
        // 도구 버튼 클릭 이벤트
        document.querySelectorAll('.tool-btn[data-tool]').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                currentTool = button.getAttribute('data-tool');
                
                // 도구에 따라 커서 변경 (두 캔버스 모두)
                canvases.forEach(canvas => {
                    if (currentTool === 'erase') {
                        canvas.style.cursor = 'cell';
                    } else if (currentTool === 'line' || currentTool === 'rect-select') {
                        canvas.style.cursor = 'crosshair';
                    } else {
                        canvas.style.cursor = 'crosshair';
                    }
                });
                
                // 도구 설명 표시
                if (currentTool === 'rect-select') {
                    console.log('💡 사각형 선택: 드래그하여 영역을 선택하면 자동 삭제됩니다');
                }
            });
        });
        
        // 브러시 크기 조절
        brushSize.addEventListener('input', () => {
            brushSizeValue.textContent = brushSize.value;
        });
        
        // 각 캔버스에 이벤트 리스너 추가
        canvases.forEach(canvas => {
            // 마우스 이벤트
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseout', stopDrawing);
            
            // 터치 이벤트 (모바일 지원)
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                canvas.dispatchEvent(mouseEvent);
            });
            
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
                canvas.dispatchEvent(mouseEvent);
            });
            
            canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                const mouseEvent = new MouseEvent('mouseup', {});
                canvas.dispatchEvent(mouseEvent);
            });
        });
        
        // 실행취소/다시실행 버튼
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);
        
        // 편집 초기화 버튼
        clearEditsButton.addEventListener('click', () => {
            if (confirm('모든 편집 내용을 삭제하고 원본 도안으로 되돌리시겠습니까?')) {
                restoreOriginal();
            }
        });
    }
    
    // 그리기 시작
    function startDrawing(e) {
        const canvas = e.currentTarget; // 클릭된 캔버스 가져오기
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        currentCanvas = canvas; // 현재 그리는 캔버스 저장
        
        isDrawing = true;
        
        if (currentTool === 'line') {
            lineStartX = x;
            lineStartY = y;
        } else if (currentTool === 'rect-select') {
            selectionStart = { x, y };
            selectionPath = [{ x, y }];
            
            // 임시 캔버스 생성 (선택 영역 미리보기)
            if (!tempCanvas) {
                tempCanvas = document.createElement('canvas');
                tempCanvas.style.position = 'absolute';
                tempCanvas.style.pointerEvents = 'none';
                tempCanvas.style.left = canvas.offsetLeft + 'px';
                tempCanvas.style.top = canvas.offsetTop + 'px';
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                canvas.parentElement.appendChild(tempCanvas);
            }
            
            // 선택 도구도 isDrawing을 true로 설정하여 draw 함수가 호출되도록 함
        } else {
            // 히스토리 저장
            saveToHistory();
            
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    }
    
    // 그리기
    function draw(e) {
        if (!isDrawing || !currentCanvas) return;
        
        const rect = currentCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (currentCanvas.width / rect.width);
        const y = (e.clientY - rect.top) * (currentCanvas.height / rect.height);
        
        const ctx = currentCanvas.getContext('2d', { willReadFrequently: true });
        
        if (currentTool === 'line') {
            // 직선 그리기 (미리보기)
            return; // mouseup에서 처리
        } else if (currentTool === 'rect-select') {
            // 사각형 선택 미리보기
            if (tempCanvas && selectionStart) {
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.strokeStyle = '#0066ff';
                tempCtx.lineWidth = 2;
                tempCtx.setLineDash([5, 5]);
                tempCtx.strokeRect(
                    selectionStart.x,
                    selectionStart.y,
                    x - selectionStart.x,
                    y - selectionStart.y
                );
            }
            return;
        } else if (currentTool === 'erase') {
            // 지우개
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = parseInt(brushSize.value) * 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else {
            // 그리기
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawColor.value;
            ctx.lineWidth = parseInt(brushSize.value);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    }
    
    // 그리기 종료
    function stopDrawing(e) {
        if (!isDrawing || !currentCanvas) return;
        
        const ctx = currentCanvas.getContext('2d', { willReadFrequently: true });
        const originalCanvas = document.getElementById('originalCanvas');
        const isEditingOriginal = (currentCanvas === originalCanvas);
        
        const rect = currentCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (currentCanvas.width / rect.width);
        const y = (e.clientY - rect.top) * (currentCanvas.height / rect.height);
        
        if (currentTool === 'line' && lineStartX !== null && lineStartY !== null) {
            // 직선 그리기
            saveToHistory();
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = drawColor.value;
            ctx.lineWidth = parseInt(brushSize.value);
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(lineStartX, lineStartY);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            lineStartX = null;
            lineStartY = null;
        } else if (currentTool === 'rect-select' && selectionStart) {
            // 사각형 영역 삭제 (최소 크기 확인)
            const width = Math.abs(x - selectionStart.x);
            const height = Math.abs(y - selectionStart.y);
            
            // 최소 5x5 픽셀 이상일 때만 삭제 (실수 클릭 방지)
            if (width > 5 && height > 5) {
                saveToHistory();
                
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillRect(
                    Math.min(selectionStart.x, x),
                    Math.min(selectionStart.y, y),
                    width,
                    height
                );
            }
            
            // 임시 캔버스 정리
            if (tempCanvas) {
                tempCanvas.getContext('2d').clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            }
            
            selectionStart = null;
        }
        
        isDrawing = false;
        ctx.beginPath();
        
        // 원본 캔버스를 편집했다면 자동으로 도안 재생성
        if (isEditingOriginal && !resultSection.classList.contains('disabled')) {
            console.log('✏️ 원본 이미지 편집 감지 - 도안 자동 재생성 중...');
            setTimeout(() => {
                generateColoringPage();
            }, 100);
        }
        
        currentCanvas = null;
    }
    
    // 히스토리 저장
    function saveToHistory() {
        const resultCanvas = document.getElementById('resultCanvas');
        const imageData = resultCanvas.toDataURL();
        
        // 현재 단계 이후의 히스토리 삭제
        editHistory = editHistory.slice(0, historyStep + 1);
        
        // 새 상태 추가
        editHistory.push(imageData);
        historyStep++;
        
        // 히스토리 크기 제한 (메모리 관리)
        if (editHistory.length > 50) {
            editHistory.shift();
            historyStep--;
        }
    }
    
    // 실행취소
    function undo() {
        if (historyStep > 0) {
            historyStep--;
            restoreFromHistory(editHistory[historyStep]);
        }
    }
    
    // 다시실행
    function redo() {
        if (historyStep < editHistory.length - 1) {
            historyStep++;
            restoreFromHistory(editHistory[historyStep]);
        }
    }
    
    // 히스토리에서 복원
    function restoreFromHistory(dataURL) {
        const resultCanvas = document.getElementById('resultCanvas');
        const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
        
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = dataURL;
    }
    
    // 원본으로 복원
    function restoreOriginal() {
        if (originalColoringPage) {
            const resultCanvas = document.getElementById('resultCanvas');
            const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
            
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
                ctx.drawImage(img, 0, 0);
                
                // 히스토리 초기화
                editHistory = [resultCanvas.toDataURL()];
                historyStep = 0;
            };
            img.src = originalColoringPage;
        }
    }

    console.log('✅ 컬러링 도안 생성기 준비 완료! 🎨');

}); // DOMContentLoaded 끝
