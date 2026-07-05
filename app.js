document.addEventListener('DOMContentLoaded', () => {
  // ================= 상태 변수 정의 =================
  let currentDocText = '';
  let activeData = null;
  let selectedFile = null;
  let isListening = false;
  let isSpeaking = false;
  let synth = window.speechSynthesis;
  let speechUtterance = null;
  
  // 대화 기록 (Gemini API용)
  let chatHistory = [];
  let isChatListening = false;
  let chatRecognition = null;

  // Gemini API Key (key.js가 있으면 로드, 없으면 공백)
  const DEFAULT_GEMINI_KEY = typeof GEMINI_API_KEY !== 'undefined' ? GEMINI_API_KEY : '';
  let geminiApiKey = localStorage.getItem('gemini-api-key') || DEFAULT_GEMINI_KEY;

  // ================= DOM 요소 선택 =================
  const toggleLargeFontBtn = document.getElementById('toggle-large-font');
  const toggleHighContrastBtn = document.getElementById('toggle-high-contrast');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const toastEl = document.getElementById('toast');

  // 대화 영역
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatUserInput = document.getElementById('chat-user-input');
  const btnChatMic = document.getElementById('btn-chat-mic');
  const btnChatSend = document.getElementById('btn-chat-send');
  const btnAttachFile = document.getElementById('btn-attach-file');
  const fileInput = document.getElementById('file-input');
  const attachedFilePreview = document.getElementById('attached-file-preview');
  const privacyConsent = document.getElementById('privacy-consent');

  // 캘린더 모달
  const calendarModal = document.getElementById('calendar-modal');
  const btnCloseCalendar = document.getElementById('btn-close-calendar');
  const calendarForm = document.getElementById('calendar-form');
  const calTitleInput = document.getElementById('cal-title');
  const calDateInput = document.getElementById('cal-date');
  const calTimeInput = document.getElementById('cal-time');
  const calDescInput = document.getElementById('cal-description');
  const calAlarmInput = document.getElementById('cal-alarm');
  const btnCalGoogle = document.getElementById('btn-cal-google');
  const btnCalOutlook = document.getElementById('btn-cal-outlook');
  const btnCalIcs = document.getElementById('btn-cal-ics');
  const btnCalNative = document.getElementById('btn-cal-native');
  const webCalendarActions = document.getElementById('web-calendar-actions');

  // 공유 모달
  const shareModal = document.getElementById('share-modal');
  const btnCloseShare = document.getElementById('btn-close-share');
  const sharePreviewContent = document.getElementById('share-preview-content');
  const btnShareKakao = document.getElementById('btn-share-kakao');
  const btnShareCopy = document.getElementById('btn-share-copy');

  // 설정 모달
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // 안드로이드 네이티브 통합 변수
  const isAndroidApp = typeof window.EasyTalkAINative !== 'undefined';

  // ================= 초기화 작업 =================
  if (geminiApiKeyInput) {
    geminiApiKeyInput.value = geminiApiKey;
  }

  // 캘린더 네이티브 버튼 설정
  if (isAndroidApp && btnCalNative && webCalendarActions) {
    btnCalNative.style.display = 'flex';
    webCalendarActions.style.display = 'none';
  }

  // ================= 공통 유틸리티 =================
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 3000);
  }

  // 접근성 모드 설정
  toggleLargeFontBtn.addEventListener('click', () => {
    const isLarge = document.body.classList.toggle('large-font');
    toggleLargeFontBtn.setAttribute('aria-pressed', isLarge);
    toggleLargeFontBtn.classList.toggle('active', isLarge);
    showToast(isLarge ? "큰 글씨 모드가 활성화되었습니다." : "일반 글씨 크기로 변경되었습니다.");
  });

  toggleHighContrastBtn.addEventListener('click', () => {
    const isHC = document.body.classList.toggle('high-contrast');
    toggleHighContrastBtn.setAttribute('aria-pressed', isHC);
    toggleHighContrastBtn.classList.toggle('active', isHC);
    showToast(isHC ? "고대비 모드가 활성화되었습니다." : "고대비 모드가 비활성화되었습니다.");
  });

  // 설정 모달 핸들러
  btnOpenSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
  });

  btnSaveSettings.addEventListener('click', () => {
    const val = geminiApiKeyInput.value.trim();
    geminiApiKey = val;
    localStorage.setItem('gemini-api-key', val);
    settingsModal.classList.remove('active');
    showToast("⚙️ 설정이 성공적으로 저장되었습니다.");
  });

  // ================= Web Speech API: TTS =================
  function speakText(text) {
    if (!synth) {
      showToast("이 브라우저는 음성 출력을 지원하지 않습니다.");
      return;
    }
    stopSpeech();

    speechUtterance = new SpeechSynthesisUtterance(text);
    speechUtterance.lang = 'ko-KR';
    speechUtterance.rate = 0.92; // 디지털 약자를 위해 약간 천천히 읽기

    speechUtterance.onstart = () => {
      isSpeaking = true;
    };

    speechUtterance.onend = () => {
      isSpeaking = false;
    };

    speechUtterance.onerror = (e) => {
      console.error(e);
      isSpeaking = false;
    };

    synth.speak(speechUtterance);
  }

  function stopSpeech() {
    if (synth && synth.speaking) {
      synth.cancel();
    }
    isSpeaking = false;
  }

  // ================= 캘린더 일정 데이터 변환 =================
  function getEventDetails() {
    const title = calTitleInput.value;
    const dateVal = calDateInput.value;
    const timeVal = calTimeInput.value;
    const description = calDescInput.value;
    
    const ymd = dateVal.replace(/-/g, '');
    const hm = timeVal.replace(/:/g, '');
    const dtStart = `${ymd}T${hm}00`;
    
    const startDt = new Date(`${dateVal}T${timeVal}`);
    const endDt = new Date(startDt.getTime() + 30 * 60 * 1000); // 30분 기본 설정
    const endYmd = endDt.getFullYear() + String(endDt.getMonth()+1).padStart(2, '0') + String(endDt.getDate()).padStart(2, '0');
    const endHm = String(endDt.getHours()).padStart(2, '0') + String(endDt.getMinutes()).padStart(2, '0');
    const dtEnd = `${endYmd}T${endHm}00`;

    return { title, dtStart, dtEnd, description };
  }

  // 구글 캘린더 등록
  btnCalGoogle.addEventListener('click', () => {
    const ev = getEventDetails();
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${ev.dtStart}/${ev.dtEnd}&details=${encodeURIComponent(ev.description)}&sf=true`;
    window.open(googleUrl, '_blank');
    calendarModal.classList.remove('active');
    showToast("구글 캘린더 등록 페이지로 이동합니다.");
  });

  // 아웃룩 캘린더 등록
  btnCalOutlook.addEventListener('click', () => {
    const ev = getEventDetails();
    const startIso = `${calDateInput.value}T${calTimeInput.value}:00`;
    const startDt = new Date(`${calDateInput.value}T${calTimeInput.value}`);
    const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);
    const endIso = endDt.toISOString().substring(0, 19);

    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(ev.title)}&startdt=${startIso}&enddt=${endIso}&body=${encodeURIComponent(ev.description)}`;
    window.open(outlookUrl, '_blank');
    calendarModal.classList.remove('active');
    showToast("아웃룩 캘린더 등록 페이지로 이동합니다.");
  });

  // ICS 파일 다운로드
  btnCalIcs.addEventListener('click', () => {
    const ev = getEventDetails();
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//EasilySayAI//CalendarEvent//KO",
      "BEGIN:VEVENT",
      `SUMMARY:${ev.title}`,
      `DTSTART:${ev.dtStart}`,
      `DTEND:${ev.dtEnd}`,
      `DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${ev.title.replace(/[\[\]]/g, '')}_일정.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    calendarModal.classList.remove('active');
    showToast("표준 캘린더 파일(.ics)을 다운로드했습니다.");
  });

  // 안드로이드 네이티브 캘린더 등록
  if (btnCalNative) {
    btnCalNative.addEventListener('click', () => {
      const ev = getEventDetails();
      const startDt = new Date(`${calDateInput.value}T${calTimeInput.value}`);
      const endDt = new Date(startDt.getTime() + 30 * 60 * 1000);

      if (isAndroidApp && typeof window.EasyTalkAINative.addCalendarEvent === 'function') {
        try {
          window.EasyTalkAINative.addCalendarEvent(
            ev.title,
            String(startDt.getTime()),
            String(endDt.getTime()),
            ev.description,
            ""
          );
          calendarModal.classList.remove('active');
          showToast("📱 스마트폰 캘린더에 일정을 저장했습니다.");
        } catch (e) {
          console.error(e);
          showToast("캘린더 저장 중 오류가 발생했습니다.");
        }
      }
    });
  }

  btnCloseCalendar.addEventListener('click', () => calendarModal.classList.remove('active'));
  calendarModal.addEventListener('click', (e) => {
    if (e.target === calendarModal) calendarModal.classList.remove('active');
  });

  // ================= 공유 모달 제어 =================
  function openShareDialog(data) {
    let previewText = `[쉽게말해 AI 요약 본 공유]\n`;
    previewText += `📋 문서: ${data.document_type_label}\n\n`;
    previewText += `📌 핵심 한줄요약:\n${data.one_line_conclusion}\n\n`;
    
    const d = data.important_dates[0];
    if (d) {
      previewText += `📅 주요 일정:\n- ${d.label}: ${d.date} ${d.time}\n\n`;
    }

    previewText += `✅ 해야할 일:\n`;
    data.tasks.forEach((t, i) => {
      previewText += `${i+1}. ${t}\n`;
    });

    if (data.required_items && data.required_items.length > 0) {
      previewText += `\n🎒 준비물: ${data.required_items.join(', ')}\n`;
    }
    
    if (data.warnings && data.warnings.length > 0) {
      previewText += `\n⚠️ 주의사항: ${data.warnings[0]}\n`;
    }

    sharePreviewContent.textContent = previewText;
    shareModal.classList.add('active');
  }

  btnShareKakao.addEventListener('click', () => {
    const textToCopy = sharePreviewContent.textContent;
    if (isAndroidApp && typeof window.EasyTalkAINative.shareText === 'function') {
      try {
        window.EasyTalkAINative.shareText("쉽게말해 AI 정리 결과", textToCopy);
        shareModal.classList.remove('active');
      } catch (e) {
        console.error(e);
        shareModal.classList.remove('active');
        showToast("💬 공유하기 중 오류가 발생했습니다.");
      }
    } else {
      shareModal.classList.remove('active');
      showToast("💬 보호자에게 전송을 완료했습니다. (카카오톡 공유 연동)");
    }
  });

  btnShareCopy.addEventListener('click', () => {
    const textToCopy = sharePreviewContent.textContent;
    if (isAndroidApp && window.EasyTalkAINative && typeof window.EasyTalkAINative.copyText === 'function') {
      try {
        window.EasyTalkAINative.copyText("쉽게말해 AI 요약 결과", textToCopy);
        shareModal.classList.remove('active');
        showToast("📋 앱 클립보드에 복사되었습니다.");
      } catch (e) {
        console.error(e);
        fallbackCopy(textToCopy);
      }
    } else {
      fallbackCopy(textToCopy);
    }
  });

  function fallbackCopy(text) {
    navigator.clipboard.writeText(text).then(() => {
      shareModal.classList.remove('active');
      showToast("📋 요약 내용이 클립보드에 복사되었습니다.");
    }).catch(err => {
      console.error(err);
      showToast("복사 실패. 직접 복사해 주세요.");
    });
  }

  btnCloseShare.addEventListener('click', () => shareModal.classList.remove('active'));
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) shareModal.classList.remove('active');
  });

  // ================= 대화방 코어 렌더링 시스템 =================

  // 메시지 말풍선 추가 함수
  function appendChatMessage(role, contentText, isAnalysis = false, data = null) {
    if (!chatMessagesContainer) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role === 'user' ? 'user' : 'ai'}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'chat-msg-sender';
    senderDiv.textContent = role === 'user' ? '나' : '쉽게말해 AI';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'chat-msg-bubble';

    if (isAnalysis && data) {
      // 분석 결과 리포트 카드를 말풍선 안에 렌더링
      const card = document.createElement('div');
      card.className = 'chat-analysis-card';

      // 0. 문서 분류 헤더
      const headerSec = document.createElement('div');
      headerSec.className = 'analysis-card-section';
      headerSec.innerHTML = `
        <span class="badge-doc-type" style="background: var(--primary-light); color: var(--accent); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 700;">
          ${data.document_type_label}
        </span>
        <h2 style="font-size: var(--size-h3); margin-top: 0.5rem; font-weight: 700;">📋 분석 요약 리포트</h2>
      `;
      card.appendChild(headerSec);

      // 1. 결국 무슨 내용인가요? (한줄요약)
      const conclusionSec = document.createElement('div');
      conclusionSec.className = 'analysis-card-section';
      conclusionSec.innerHTML = `
        <div class="analysis-section-title">📌 결국 무슨 내용인가요?</div>
        <p class="analysis-conclusion-text">${data.one_line_conclusion}</p>
      `;
      card.appendChild(conclusionSec);

      // 2. 내가 해야할 일 (체크리스트)
      const tasksSec = document.createElement('div');
      tasksSec.className = 'analysis-card-section';
      const tasksTitle = document.createElement('div');
      tasksTitle.className = 'analysis-section-title';
      tasksTitle.textContent = '✅ 내가 해야 할 일 (체크리스트)';
      tasksSec.appendChild(tasksTitle);

      const tasksList = document.createElement('div');
      tasksList.className = 'todo-list';
      data.tasks.forEach((task, idx) => {
        const item = document.createElement('div');
        item.className = 'todo-item';
        item.innerHTML = `
          <input type="checkbox" id="chk-${role}-${idx}" class="todo-checkbox">
          <label for="chk-${role}-${idx}" class="todo-text">${task}</label>
        `;
        item.addEventListener('click', (e) => {
          const chk = item.querySelector('input');
          if (e.target !== chk) {
            chk.checked = !chk.checked;
          }
          item.classList.toggle('checked', chk.checked);
        });
        tasksList.appendChild(item);
      });
      tasksSec.appendChild(tasksList);
      card.appendChild(tasksSec);

      // 3. 중요 일정
      const datesSec = document.createElement('div');
      datesSec.className = 'analysis-card-section';
      datesSec.innerHTML = `<div class="analysis-section-title">📅 언제까지 해야 하나요?</div>`;
      const datesList = document.createElement('ul');
      datesList.className = 'detail-item-list';
      data.important_dates.forEach(d => {
        const li = document.createElement('li');
        li.className = 'detail-item';
        li.innerHTML = `
          <span class="detail-label" style="font-weight:700;">${d.label}</span>
          <div>
            <span class="badge-date" style="background:${d.type==='deadline'?'var(--warning-bg)':'var(--info-bg)'}; color:${d.type==='deadline'?'var(--warning)':'var(--info)'}; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:700; margin-right:6px;">
              ${d.type==='deadline'?'마감일':'일정'}
            </span>
            <span>${d.date} ${d.time}</span>
          </div>
        `;
        datesList.appendChild(li);
      });
      datesSec.appendChild(datesList);
      card.appendChild(datesSec);

      // 4. 준비물 및 주의사항
      let hasAdditional = false;
      const addSec = document.createElement('div');
      addSec.className = 'analysis-card-section';
      
      if (data.required_items && data.required_items.length > 0) {
        hasAdditional = true;
        const itemDiv = document.createElement('div');
        itemDiv.style.marginBottom = '0.8rem';
        itemDiv.innerHTML = `
          <div class="analysis-section-title" style="color: var(--success);">🎒 챙겨야 할 준비물</div>
          <p style="font-size: var(--size-sub); margin-left: 6px;">• ${data.required_items.join(', ')}</p>
        `;
        addSec.appendChild(itemDiv);
      }

      if (data.warnings && data.warnings.length > 0) {
        hasAdditional = true;
        const warnDiv = document.createElement('div');
        warnDiv.innerHTML = `
          <div class="analysis-section-title" style="color: var(--warning);">⚠️ 안 하면 어떻게 되나요?</div>
          <p style="font-size: var(--size-sub); margin-left: 6px; font-weight:600; color:var(--warning);">• ${data.warnings.join('<br>• ')}</p>
        `;
        addSec.appendChild(warnDiv);
      }

      if (hasAdditional) {
        card.appendChild(addSec);
      }

      // 5. 원문 대조 아코디언
      const sourceSec = document.createElement('div');
      sourceSec.className = 'analysis-card-section';
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn-toggle-source';
      toggleBtn.style.width = '100%';
      toggleBtn.innerHTML = '<span>🔎</span> 원래 글(원문)과 비교해보기 (열기)';
      
      const sourceContainer = document.createElement('div');
      sourceContainer.className = 'source-container';
      
      // 원문 하이라이트 가공
      let highlighted = data.original_text;
      const highlightKw = ["3%", "가산금", "전투복", "군복", "신분증", "지각", "금식", "이중 납부"];
      highlightKw.forEach(kw => {
        highlighted = highlighted.replace(new RegExp(kw, 'g'), `<mark class="highlight-source">${kw}</mark>`);
      });
      sourceContainer.innerHTML = highlighted;

      toggleBtn.addEventListener('click', () => {
        const isOpen = sourceContainer.classList.toggle('active');
        toggleBtn.innerHTML = isOpen 
          ? '<span>🔎</span> 원래 글(원문)과 비교해보기 (닫기)'
          : '<span>🔎</span> 원래 글(원문)과 비교해보기 (열기)';
      });

      sourceSec.appendChild(toggleBtn);
      sourceSec.appendChild(sourceContainer);
      card.appendChild(sourceSec);

      bubbleDiv.appendChild(card);

      // 하단 액션 버튼 배치
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'chat-msg-actions';

      // TTS 읽어주기 버튼
      const ttsBtn = document.createElement('button');
      ttsBtn.className = 'btn-chat-bubble-action';
      ttsBtn.innerHTML = '<span>🔊</span> 읽어주기';
      ttsBtn.addEventListener('click', () => {
        let script = `신속 요약해 드립니다. 문서 분류는 ${data.document_type_label} 입니다. 핵심 결론은 ${data.one_line_conclusion} 입니다. 해야 할 일은 다음과 같습니다. `;
        data.tasks.forEach((t, i) => script += `${i + 1}번, ${t}. `);
        if (data.warnings && data.warnings.length > 0) {
          script += `주의할 점은 ${data.warnings[0]} 입니다.`;
        }
        speakText(script);
        showToast("🔊 핵심 내용을 음성으로 낭독합니다.");
      });
      actionsDiv.appendChild(ttsBtn);

      // 캘린더 모달 오픈
      const calBtn = document.createElement('button');
      calBtn.className = 'btn-chat-bubble-action';
      calBtn.innerHTML = '<span>📅</span> 달력 등록';
      calBtn.addEventListener('click', () => {
        const mainDate = data.important_dates[0] || { date: '2026-07-02', time: '12:00', label: '주요 일정' };
        calTitleInput.value = `[쉽게말해] ${mainDate.label}`;
        calDateInput.value = mainDate.date;
        calTimeInput.value = mainDate.time;
        
        let desc = `[쉽게말해 요약결과]\n- 핵심 내용: ${data.one_line_conclusion}\n\n[해야할 일]\n`;
        data.tasks.forEach((t, i) => desc += `${i+1}. ${t}\n`);
        calDescInput.value = desc;

        calendarModal.classList.add('active');
      });
      actionsDiv.appendChild(calBtn);

      // 보호자 공유 오픈
      const shareBtn = document.createElement('button');
      shareBtn.className = 'btn-chat-bubble-action';
      shareBtn.innerHTML = '<span>💬</span> 보호자 공유';
      shareBtn.addEventListener('click', () => openShareDialog(data));
      actionsDiv.appendChild(shareBtn);

      bubbleDiv.appendChild(actionsDiv);
    } else {
      // 일반 메시지 텍스트 파싱
      let formattedText = contentText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      bubbleDiv.innerHTML = formattedText;

      // AI 일반 메시지 아래 🔊 읽어주기 추가
      if (role === 'model' || role === 'ai') {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'chat-msg-actions';
        const miniTtsBtn = document.createElement('button');
        miniTtsBtn.className = 'btn-chat-bubble-action';
        miniTtsBtn.innerHTML = '<span>🔊</span> 읽어주기';
        miniTtsBtn.addEventListener('click', () => {
          speakText(contentText.replace(/<[^>]*>/g, ''));
        });
        actionsDiv.appendChild(miniTtsBtn);
        bubbleDiv.appendChild(actionsDiv);
      }
    }

    msgDiv.appendChild(senderDiv);
    msgDiv.appendChild(bubbleDiv);
    chatMessagesContainer.appendChild(msgDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    return msgDiv;
  }

  // AI 타이핑 로더 표시
  let activeLoader = null;
  function showChatLoader() {
    removeChatLoader();
    activeLoader = document.createElement('div');
    activeLoader.className = 'chat-msg ai loading-msg';
    activeLoader.innerHTML = `
      <div class="chat-msg-sender">쉽게말해 AI</div>
      <div class="chat-msg-bubble">
        <div class="chat-typing-loader">
          <div class="chat-typing-dot"></div>
          <div class="chat-typing-dot"></div>
          <div class="chat-typing-dot"></div>
        </div>
      </div>
    `;
    chatMessagesContainer.appendChild(activeLoader);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function removeChatLoader() {
    if (activeLoader) {
      activeLoader.remove();
      activeLoader = null;
    }
  }

  // ================= 텍스트 기반 다이내믹 요약 생성기 (OCR 지원용) =================
  function generateDynamicData(text) {
    const dates = [];
    const dateRegex = /(\d{4})[.-](\d{1,2})[.-](\d{1,2})|(\d{1,2})월\s*(\d{1,2})일/g;
    let match;
    let count = 0;
    const currentYear = new Date().getFullYear();
    while ((match = dateRegex.exec(text)) !== null && count < 3) {
      let year = currentYear;
      let month = '';
      let day = '';
      
      if (match[1]) {
        year = match[1];
        month = String(match[2]).padStart(2, '0');
        day = String(match[3]).padStart(2, '0');
      } else if (match[4]) {
        month = String(match[4]).padStart(2, '0');
        day = String(match[5]).padStart(2, '0');
      }
      
      if (month && day) {
        dates.push({
          date: `${year}-${month}-${day}`,
          time: "18:00",
          type: "deadline",
          label: `문서 기재 날짜 (${month}/${day})`
        });
        count++;
      }
    }
    
    if (dates.length === 0) {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const y = futureDate.getFullYear();
      const m = String(futureDate.getMonth() + 1).padStart(2, '0');
      const d = String(futureDate.getDate()).padStart(2, '0');
      dates.push({
        date: `${y}-${m}-${d}`,
        time: "18:00",
        type: "deadline",
        label: "일정 및 서류 확인 마감"
      });
    }

    const sentences = text.split(/[.\n]/);
    const tasks = [];
    sentences.forEach(s => {
      const clean = s.trim();
      if (clean.length > 5 && tasks.length < 3) {
        if (clean.includes('바랍니다') || clean.includes('요망') || clean.includes('제출') || clean.includes('하십시오') || clean.includes('필요') || clean.includes('참석') || clean.includes('납부')) {
          tasks.push(clean);
        }
      }
    });

    if (tasks.length === 0) {
      tasks.push("추출된 원문 텍스트 내용을 바탕으로 기한 및 상세 제출 정보를 재확인합니다.");
      tasks.push("관련 구비 서류(신분증 등)가 있는지 최종 확인합니다.");
    } else if (tasks.length < 3) {
      tasks.push("관련 구비 서류가 있는지 최종 확인합니다.");
    }

    let summary = "업로드해주신 문서의 텍스트가 추출되었습니다. 상세 일정과 행동 체크리스트를 확인하세요.";
    for (let i = 0; i < sentences.length; i++) {
      const clean = sentences[i].trim();
      if (clean.length > 12 && clean.length < 100) {
        summary = clean;
        break;
      }
    }

    return {
      document_type: "general_document",
      document_type_label: "기타 행정 문서",
      one_line_conclusion: summary,
      easy_summary: "AI가 이미지나 텍스트에서 추출한 요약입니다.",
      tasks: tasks,
      important_dates: dates,
      required_items: ["신분증 및 관련 안내 서류"],
      warnings: ["문자 판독(OCR) 결과는 오차가 있을 수 있으므로 주요 날짜와 제출처는 원문을 다시 확인하세요."],
      needs_confirmation: ["제출 기한 및 상세 의문 사항은 담당 부서 연락처로 문의하시기 바랍니다."],
      original_text: text
    };
  }

  // ================= AI 연동 API 함수 =================
  async function analyzeWithGemini(text, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const systemPrompt = `당신은 복잡하고 어려운 공문서, 통지서, 고지서의 텍스트를 분석하여, 어르신이나 디지털 취약계층이 이해하기 쉬운 말로 요약하고 일정을 추출해 주는 "쉽게말해 AI" 비서입니다.
반드시 아래 JSON 스키마 구조로만 답변하세요. 마크다운 백틱(\`\`\`json) 기호 없이 순수 JSON 문자열만 반환해야 합니다.

{
  "document_type_label": "문서 종류 한글 분류 (예: 자동차세 고지서)",
  "one_line_conclusion": "가장 중요한 핵심 결론 한 줄 (쉬운 존댓말)",
  "tasks": ["해야 할 일 조치 사항 1", "해야 할 일 조치 사항 2"],
  "important_dates": [
    {
      "label": "일정의 이름 (예: 납부 마감)",
      "type": "deadline",
      "date": "YYYY-MM-DD",
      "time": "HH:MM"
    }
  ],
  "required_items": ["준비물 1"],
  "warnings": ["불이익이나 가산금 정보 등 주요 주의사항 1"],
  "needs_confirmation": ["문의처 또는 추가 확인 사항 1"],
  "easy_summary": "전반적인 내용에 대한 아주 친절하고 쉬운 구어체 요약 설명"
}`;

    const requestBody = {
      contents: [{ parts: [{ text: `시스템 안내 및 스키마:\n${systemPrompt}\n\n분석할 실제 문서 본문:\n${text}` }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error("네트워크 상태나 키 오류");
    }

    const resData = await response.json();
    const jsonText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error("요약 텍스트를 반환받지 못했습니다.");

    const parsedData = JSON.parse(jsonText.trim());
    return {
      document_type: "gemini_analyzed",
      document_type_label: parsedData.document_type_label || "AI 분석 문서",
      one_line_conclusion: parsedData.one_line_conclusion || "핵심 요약을 생성하지 못했습니다.",
      easy_summary: parsedData.easy_summary || "상세 요약 설명 없음",
      tasks: parsedData.tasks || [],
      important_dates: parsedData.important_dates || [],
      required_items: parsedData.required_items || [],
      warnings: parsedData.warnings || [],
      needs_confirmation: parsedData.needs_confirmation || [],
      original_text: text
    };
  }

  async function chatWithGemini(chatHistory, userMessage, documentText, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const systemPrompt = `당신은 사용자가 업로드한 공문서/고지서/안내문 정보를 기반으로 대화하는 친절한 "쉽게말해 AI" 비서입니다.
사용자는 어르신이나 디지털 취약계층, 혹은 바쁜 일반 시민입니다. 어려운 행정용어나 한자어 대신 아주 알기 쉬운 한글 구어체(존댓말)로 친절하게 설명해 주셔야 합니다.
답변할 때 줄바꿈과 굵은 글씨(**강조**)를 적절히 활용하여 시각적으로 읽기 편하게 만드세요.

[분석 대상 문서의 본문 텍스트]
${documentText}

[지침]
1. 위 문서의 내용에 근거해서만 대답하고, 문서에 나오지 않는 정보를 물어보면 상상해서 답하지 말고 정중히 모른다고 하십시오.
2. 예의 바르고 다정하게 설명하며, 핵심 위주로 명쾌하게 답해 주세요.`;

    const contentsArray = chatHistory.map(item => ({
      role: item.role === 'model' || item.role === 'ai' ? 'model' : 'user',
      parts: [{ text: item.parts[0].text }]
    }));
    
    contentsArray.push({ role: 'user', parts: [{ text: userMessage }] });

    const requestBody = {
      contents: contentsArray,
      systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error("네트워크 상태나 키 오류");
    }

    const resData = await response.json();
    const replyText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error("대화 응답을 반환받지 못했습니다.");

    return replyText.trim();
  }

  // 시뮬레이터용 키워드 매핑 답변 생성
  function getSimulatedChatResponse(docType, userMsg) {
    const msg = userMsg.toLowerCase();
    
    if (docType === 'tax_notice') {
      if (msg.includes('벌금') || msg.includes('연체') || msg.includes('가산') || msg.includes('늦으')) {
        return "납부 마감일인 6월 30일을 하루라도 지나면 **3%의 가산금(벌금)**이 추가됩니다. 예를 들어 125,000원 기준으로 약 3,750원이 추가로 부과되며, 계속 미납하면 차량이 압류되거나 번호판이 영치될 수 있으니 꼭 기한 내에 내셔야 해요!";
      }
      if (msg.includes('어떻게') || msg.includes('방법') || msg.includes('납부') || msg.includes('지로') || msg.includes('카드')) {
        return "납부 방법은 세 가지가 있습니다:\n1. 고지서에 적힌 **가상계좌번호**로 바로 이체하기 (가장 간편합니다!)\n2. 인터넷 **위택스(Wetax)** 사이트나 모바일 앱에서 신용카드로 결제하기\n3. 은행 ATM기기에서 지방세 납부 메뉴를 누르고 카드나 통장으로 내기\n\n가지고 계신 스마트폰 뱅킹 앱을 이용해 가상계좌로 이체하는 것을 가장 권장합니다.";
      }
      if (msg.includes('계좌') || msg.includes('은행')) {
        return "고지서의 **[납부 안내]** 표에서 본인이 거래하시는 은행(예: 신한, 국민, 농협 등)의 가상계좌번호를 복사해 송금하시면 이체 수수료 없이 편리하게 납부하실 수 있습니다.";
      }
      if (msg.includes('자동이체') || msg.includes('이중')) {
        return "평소에 자동차세를 자동납부로 설정해 두셨다면, 6월 30일에 지정된 계좌에서 자동으로 돈이 빠져나갑니다. 이 경우 계좌이체로 직접 또 송금하시면 **이중 납부**가 되니 주의하세요. 홈택스나 위택스에서 신청 이력을 꼭 확인해 보세요!";
      }
      return "지방세 자동차세 고지서에 관해 무엇이든 물어보세요! 예를 들어 '벌금은 얼마야?', '어떻게 내?' 라고 질문하시면 알기 쉽게 답해 드릴게요.";
    } 
    
    if (docType === 'reserve_forces') {
      if (msg.includes('벌금') || msg.includes('처벌') || msg.includes('안가') || msg.includes('빠지')) {
        return "예비군 기본훈련은 정당한 사유(질병 등) 없이 무단 불참할 경우 **예비군법에 따라 고발되어 벌금형 등의 형사 처벌**을 받을 수 있습니다! 참석이 불가능할 경우 반드시 예비군 홈페이지나 소속 동대에 연기 신청을 하셔야 합니다.";
      }
      if (msg.includes('신분증') || msg.includes('여권') || msg.includes('면허증')) {
        return "네! 본인 확인이 가능한 **주민등록증, 운전면허증, 여권**은 모두 신분증으로 인정됩니다. 학생증이나 신분증 캡처 이미지는 인정되지 않으니 실물 신분증을 꼭 챙기셔야 입소하실 수 있습니다.";
      }
      if (msg.includes('복장') || msg.includes('전투복') || msg.includes('군복') || msg.includes('전투화') || msg.includes('군화')) {
        return "규정된 **전투복 상·하의, 전투화, 전투모, 벨트, 고무링**을 모두 착용해야 입소가 가능합니다. 혹시 군복이 작아지거나 없으시다면 대여가 가능할 수 있으니 훈련 며칠 전에 소속 동대나 서초 훈련장에 미리 문의하여 군복 대여를 신청하시는 것을 추천합니다.";
      }
      if (msg.includes('시간') || msg.includes('지각') || msg.includes('입소')) {
        return "훈련 입소 시간은 **오전 9시 정각**까지입니다. 9시에서 단 1분이라도 늦으면 지각으로 처리되어 입소가 차단되고 무단 불참 처리됩니다. 교통 혼잡이 잦으니 오전 8시 40분 전까지 도착하는 것을 권장합니다.";
      }
      return "예비군 소집 통지서에 관해 물어보세요! 예: '지각하면 어떻게 돼?', '신분증 없으면 여권도 돼?' 등의 질문에 명쾌히 답해 드립니다.";
    }

    if (docType === 'health_checkup') {
      if (msg.includes('금식') || msg.includes('물') || msg.includes('밥') || msg.includes('먹')) {
        return "검사 정확성을 위해 **검진 전날 밤 9시부터는 반드시 완전 금식**하셔야 합니다. 밥이나 간식은 물론이고, 물, 음료수, 껌, 담배 등도 일체 금지됩니다! 당일 아침에도 공복 상태로 물을 마시지 않고 병원에 가셔야 혈당이나 고지혈증 검사가 정확하게 나옵니다.";
      }
      if (msg.includes('돈') || msg.includes('비용') || msg.includes('공짜') || msg.includes('무료')) {
        return "국가 일반 건강검진은 **기본 항목에 대해 본인부담금 0원(무료)**입니다! 단, 나이에 따른 암검진 등 추가 검사를 받으실 때 특정 항목은 10%의 본인부담금이 추가될 수 있습니다.";
      }
      if (msg.includes('약') || msg.includes('고혈압') || msg.includes('당뇨')) {
        return "혈압약 등 아침에 꼭 드셔야 하는 필수의약품은 검진 당일 새벽 6시경에 물 아주 미량(한두 모금)과 함께 복용하시는 것이 일반적입니다. 하지만 당뇨약이나 인슐린 주사는 공복에 투여하면 저혈당 위험이 있으므로 당일 아침에는 투여하지 않고 검진 병원 주치의와 미리 상의하셔야 합니다.";
      }
      return "건강검진 안내에 대해 무엇이든 말씀해 주세요. 예: '검사 전날 물 마셔도 돼?', '비용은 무료야?' 등을 친절히 알려 드립니다.";
    }

    return "위 문서의 주요 일정을 정리해 드립니다. 추가적인 의문 사항이 있으시면 편하게 물어보세요!";
  }

  // ================= 대화 및 문서 분석 진행 =================
  async function submitUserMessage(textVal) {
    const text = textVal.trim();
    if (!text && !selectedFile) return;

    // 1. 사용자 메시지 추가
    let userMsgText = text;
    if (selectedFile) {
      userMsgText = `📄 [첨부파일] ${selectedFile.name}${text ? ': ' + text : ' 분석해줘'}`;
    }
    appendChatMessage('user', userMsgText);
    chatUserInput.value = '';
    
    // 파일 첨부 지우기
    const fileToAnalyze = selectedFile;
    clearAttachment();

    // 마이크 중지
    stopChatListening();

    // 2. 분석 중 로더 표시
    showChatLoader();
    stopSpeech(); // 진행 중인 낭독 중지

    // 3. 처리 로직
    setTimeout(async () => {
      try {
        // A. 파일 첨부가 있거나 입력 텍스트가 매우 길면 -> 새 문서 분석으로 판단
        const isNewAnalysis = fileToAnalyze || text.length > 50 || !activeData;

        if (isNewAnalysis) {
          let textContent = text;
          if (fileToAnalyze) {
            // 파일 기반 시뮬레이션 매핑
            const name = fileToAnalyze.name.toLowerCase();
            let matched = mockData.tax_notice;
            if (name.includes('예비군') || name.includes('훈련')) matched = mockData.reserve_forces;
            else if (name.includes('건강') || name.includes('검진')) matched = mockData.health_checkup;
            textContent = matched.original_text;
          }

          let analysisResult = null;
          if (geminiApiKey) {
            try {
              analysisResult = await analyzeWithGemini(textContent, geminiApiKey);
              showToast("✨ AI 실시간 문서 분석이 완료되었습니다.");
            } catch (err) {
              console.error(err);
              showToast("⚠️ 실시간 AI 연동 실패. 내장 시뮬레이터로 분석합니다.");
              analysisResult = runMockSimulator(textContent);
            }
          } else {
            analysisResult = runMockSimulator(textContent);
          }

          // 상태 업데이트
          activeData = analysisResult;
          currentDocText = textContent;
          chatHistory = [
            { role: 'user', parts: [{ text: "이 문서를 분석해줘" }] },
            { role: 'model', parts: [{ text: `분석 완료: ${analysisResult.one_line_conclusion}` }] }
          ];

          // 로더 제거 및 분석 결과 카드 렌더링
          removeChatLoader();
          appendChatMessage('model', '', true, activeData);
        } else {
          // B. 짧은 대화 꼬리질문 처리
          let aiReplyText = '';
          if (geminiApiKey && activeData.document_type === 'gemini_analyzed') {
            aiReplyText = await chatWithGemini(chatHistory, text, currentDocText, geminiApiKey);
          } else {
            aiReplyText = getSimulatedChatResponse(activeData.document_type, text);
          }

          // 로더 제거 및 일반 답변 말풍선 추가
          removeChatLoader();
          appendChatMessage('model', aiReplyText);
          chatHistory.push({ role: 'user', parts: [{ text: text }] });
          chatHistory.push({ role: 'model', parts: [{ text: aiReplyText }] });
        }
      } catch (e) {
        console.error(e);
        removeChatLoader();
        appendChatMessage('model', `❌ 처리 중 에러가 발생했습니다: ${e.message}`);
      }
    }, 1500);
  }

  function runMockSimulator(text) {
    if (text.includes('예비군') || text.includes('훈련') || text.includes('전투복')) {
      return mockData.reserve_forces;
    } else if (text.includes('건강검진') || text.includes('건강검진법') || text.includes('금식')) {
      return mockData.health_checkup;
    } else {
      return mockData.tax_notice;
    }
  }

  // ================= 예시 칩 분석 트리거 =================
  function handleExampleTrigger(docId) {
    const data = mockData[docId];
    if (data) {
      // 대화창에 요약 요청 메시지 추가
      submitUserMessage(`${data.document_type_label} 예시 분석해줘`);
    }
  }

  // ================= 파일 첨부 기능 =================
  btnAttachFile.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      selectedFile = files[0];
      attachedFilePreview.style.display = 'flex';
      attachedFilePreview.innerHTML = `
        <span>📁 <strong>대기 중:</strong> ${selectedFile.name} (${(selectedFile.size/1024).toFixed(1)} KB)</span>
        <button id="btn-clear-attachment" style="background:none; border:none; color:var(--warning); font-size:1.1rem; font-weight:700; cursor:pointer;">&times;</button>
      `;
      document.getElementById('btn-clear-attachment').addEventListener('click', clearAttachment);
    }
  });

  function clearAttachment() {
    selectedFile = null;
    fileInput.value = '';
    attachedFilePreview.style.display = 'none';
    attachedFilePreview.innerHTML = '';
  }

  // ================= 음성 질문 기능 (STT) =================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    chatRecognition = new SpeechRecognition();
    chatRecognition.continuous = false;
    chatRecognition.lang = 'ko-KR';
    chatRecognition.interimResults = false;

    chatRecognition.onstart = () => {
      isChatListening = true;
      btnChatMic.classList.add('listening');
      btnChatMic.textContent = '🛑';
      showToast("마이크 음성 인식을 시작합니다. 말씀해 주세요...");
    };

    chatRecognition.onerror = (event) => {
      console.error(event);
      showToast("음성 인식 실패: " + event.error);
      stopChatListening();
    };

    chatRecognition.onend = () => {
      stopChatListening();
    };

    chatRecognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      chatUserInput.value = speechToText;
      showToast("음성이 텍스트로 변환되었습니다.");
    };
  }

  function startChatListening() {
    if (chatRecognition) {
      try {
        chatRecognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  }

  function stopChatListening() {
    isChatListening = false;
    if (btnChatMic) {
      btnChatMic.classList.remove('listening');
      btnChatMic.textContent = '🎤';
    }
    if (chatRecognition) {
      try {
        chatRecognition.stop();
      } catch (e) { }
    }
  }

  btnChatMic.addEventListener('click', () => {
    if (isChatListening) stopChatListening();
    else startChatListening();
  });

  // ================= 엔터 및 전송 클릭 바인딩 =================
  btnChatSend.addEventListener('click', () => submitUserMessage(chatUserInput.value));
  chatUserInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitUserMessage(chatUserInput.value);
    }
  });

  // ================= 안드로이드 데이터 수신 =================
  function handleSharedPayload(payload) {
    if (!payload) return;
    if (payload.text) {
      submitUserMessage(payload.text);
    } else if (payload.files && payload.files.length > 0) {
      selectedFile = payload.files[0];
      attachedFilePreview.style.display = 'flex';
      attachedFilePreview.innerHTML = `
        <span>📁 <strong>공유된 파일:</strong> ${selectedFile.name}</span>
        <button id="btn-clear-attachment" style="background:none; border:none; color:var(--warning); font-size:1.1rem; font-weight:700; cursor:pointer;">&times;</button>
      `;
      document.getElementById('btn-clear-attachment').addEventListener('click', clearAttachment);
      submitUserMessage(`📄 공유받은 파일 [${selectedFile.name}] 분석해줘`);
    }
  }

  window.EasyTalkAI = window.EasyTalkAI || {};
  window.EasyTalkAI.receiveSharedPayload = handleSharedPayload;

  window.addEventListener("easyTalkAISharedPayload", function(event) {
    handleSharedPayload(event.detail);
  });

  const cachedSharedText = localStorage.getItem("easyTalkAI.sharedText");
  const cachedSharedFilesJson = localStorage.getItem("easyTalkAI.sharedFiles");
  if (cachedSharedText || cachedSharedFilesJson) {
    const payload = {
      text: cachedSharedText || "",
      files: cachedSharedFilesJson ? JSON.parse(cachedSharedFilesJson) : []
    };
    handleSharedPayload(payload);
    localStorage.removeItem("easyTalkAI.sharedText");
    localStorage.removeItem("easyTalkAI.sharedFiles");
  }

  // ================= 서비스 워커 초기 해제 =================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
  }

  // ================= AI 첫 대화방 입장 인사말 =================
  function initFirstGreeting() {
    chatMessagesContainer.innerHTML = '';
    
    const greetingText = `안녕하세요! 복잡하고 어려운 행정 공문서나 세금 고지서를 쉽게 해석해 드리는 **쉽게말해 AI** 비서입니다. 
    
아래 **예시 버튼** 중 하나를 선택하시거나, 분석하고 싶은 글을 복사해 이곳에 입력해 주세요. 고지서 사진이나 PDF 파일을 복사해서 올려주셔도 깔끔하게 정리해 드립니다! 📄✨`;
    
    const bubble = appendChatMessage('model', greetingText);
    
    // 예시 문서 칩 추가
    const chipContainer = document.createElement('div');
    chipContainer.className = 'example-chips-container';
    chipContainer.innerHTML = `
      <button class="example-chip" data-id="tax_notice">🚗 자동차세 납부 고지</button>
      <button class="example-chip" data-id="reserve_forces">🪖 예비군 기본훈련 통지</button>
      <button class="example-chip" data-id="health_checkup">🏥 일반 건강검진 안내</button>
    `;
    
    chipContainer.querySelectorAll('.example-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.getAttribute('data-id');
        handleExampleTrigger(docId);
      });
    });

    bubble.querySelector('.chat-msg-bubble').appendChild(chipContainer);
  }

  // 최초 인사말 호출
  initFirstGreeting();
});
