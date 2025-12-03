# 🎨 AI 컬러링 도안 생성기

이미지를 업로드하거나 검색하여 나만의 컬러링 도안을 만들어보세요!

## ✨ 주요 기능

### 📸 이미지 입력

- **파일 업로드**: 드래그 앤 드롭 또는 파일 선택
- **클립보드 붙여넣기**: Ctrl+V로 간편하게 이미지 붙여넣기
- **이미지 검색**: 네이버/구글 이미지 검색 연동

### 🤖 AI 자동 분석

- 이미지 복잡도 자동 분석
- 최적 설정 자동 추천
- 실시간 도안 생성

### 🎨 두 가지 도안 스타일

- **컬러링북 모드**: 상세한 내부 선까지 표현
- **누끼/실루엣 모드**: 외곽선만 깔끔하게 추출

### ⚙️ 세밀한 설정 조정

- 윤곽선 감도 (10~200)
- 선 두께 (0.1~5.0, 0.1 단위)
- 노이즈 감소 (0~10)
- 명암 대비 (0~200)
- 디테일 레벨 (낮음/보통/높음)

### ✏️ 편집 도구

- 그리기/지우개/직선 도구
- 실행취소/다시실행
- 브러시 크기 및 색상 조절

### 💾 내보내기

- PDF 저장 (A4)
- 이미지 저장 (PNG)
- 인쇄

## 🚀 GitHub Pages 배포

```bash
# 1. 저장소 초기화
git init
git add .
git commit -m "Initial commit: AI Coloring Page Generator"

# 2. GitHub에 푸시
git remote add origin https://github.com/your-username/coloring-page-generator.git
git branch -M main
git push -u origin main

# 3. GitHub Pages 활성화
# Settings > Pages > Source: main branch > Save
```

배포 후 `https://your-username.github.io/coloring-page-generator/` 에서 접속 가능합니다.

## 📱 사용 방법

1. **이미지 준비**: 업로드, 붙여넣기, 또는 검색
2. **도안 생성**: "컬러링 도안 만들기" 버튼 클릭
3. **설정 조정**: 도안 스타일, 선 두께 등 실시간 조정
4. **편집**: 필요시 그리기/지우개 도구 사용
5. **저장/인쇄**: PDF/이미지로 저장 또는 인쇄

## 🛠️ 기술 스택

- HTML5 / CSS3 / Vanilla JavaScript
- Canvas API
- jsPDF
- Sobel, CLAHE, Canny 엣지 검출

## 📄 라이선스

MIT License

---

Made with ❤️ for coloring enthusiasts
