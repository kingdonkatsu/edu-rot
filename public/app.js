document.addEventListener('DOMContentLoaded', async () => {
  let fixtures = { crashCourse: [], weeklyInsights: [] };
  let dashboard = null;

  try {
    const res = await fetch('/api/v1/fixtures');
    if (res.ok) {
      fixtures = await res.json();
      populateDropdowns(fixtures);
      setupDashboard(fixtures);
    } else {
      console.error('Failed to load fixtures');
    }
  } catch (error) {
    console.error('API Error loading fixtures:', error);
  }

  function populateDropdowns(data) {
    const ccSelect = document.getElementById('cc-fixture-select');
    ccSelect.innerHTML = '';
    data.crashCourse.forEach((student, index) => {
      const label = `${student.student_id} - ${student.topic}: ${student.subtopic}`;
      ccSelect.innerHTML += `<option value="${index}">${label}</option>`;
    });

    const wiSelect = document.getElementById('wi-fixture-select');
    wiSelect.innerHTML = '';
    data.weeklyInsights.forEach((student, index) => {
      wiSelect.innerHTML += `<option value="${index}">${student.student_id}</option>`;
    });

    const analyticsSelect = document.getElementById('analytics-student-select');
    analyticsSelect.innerHTML = '';
    const uniqueIds = [...new Set([
      ...data.crashCourse.map((item) => item.student_id),
      ...data.weeklyInsights.map((item) => item.student_id),
    ])];
    uniqueIds.forEach((studentId) => {
      analyticsSelect.innerHTML += `<option value="${studentId}">${studentId}</option>`;
    });
  }

  function setupDashboard() {
    if (!window.EduRotDashboard || typeof window.EduRotDashboard.createDashboard !== 'function') {
      return;
    }

    dashboard = window.EduRotDashboard.createDashboard();
    const select = document.getElementById('analytics-student-select');
    if (!select) return;

    const loadDashboard = async () => {
      const studentId = select.value;
      if (!studentId) return;
      try {
        await dashboard.load(studentId);
      } catch (error) {
        console.error('Dashboard load failed', error);
        const status = document.getElementById('analytics-status');
        if (status) status.textContent = 'Failed to load analytics dashboard.';
      }
    };

    select.addEventListener('change', loadDashboard);

    if (select.value) {
      loadDashboard();
    }
  }

  const btnCC = document.getElementById('btn-cc');
  const resultCC = document.getElementById('cc-result');
  const formCC = document.getElementById('crash-course-form');

  const btnCCVideo = document.getElementById('btn-cc-video');
  const resultCCVideo = document.getElementById('cc-video-result');
  const videoPlayer = document.getElementById('cc-video-player');
  const videoMock = document.getElementById('cc-video-mock');
  let currentCCPayload = null;

  formCC.addEventListener('submit', async (event) => {
    event.preventDefault();

    btnCC.querySelector('.btn-text').classList.add('hidden');
    btnCC.querySelector('.loader').classList.remove('hidden');
    btnCC.disabled = true;

    try {
      const selectedIndex = document.getElementById('cc-fixture-select').value;
      if (selectedIndex === '') {
        alert('Please wait for fixtures to load.');
        return;
      }

      const payload = fixtures.crashCourse[Number(selectedIndex)];
      const response = await fetch('/api/v1/agents/crash-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('API Request Failed');

      const data = await response.json();
      renderCrashCourse(data);

      currentCCPayload = payload;
      btnCCVideo.disabled = false;
    } catch (error) {
      console.error(error);
      alert('Failed to run Crash Course pipeline.');
    } finally {
      btnCC.querySelector('.btn-text').classList.remove('hidden');
      btnCC.querySelector('.loader').classList.add('hidden');
      btnCC.disabled = false;
    }
  });

  function renderCrashCourse(data) {
    document.getElementById('cc-attempts').textContent = `Validation Attempts: ${data.attempts}`;
    document.getElementById('cc-script-title').textContent = data.script.title;
    document.getElementById('cc-script-duration').textContent = `${data.script.target_duration_seconds}s`;
    document.getElementById('cc-script-words').textContent = `${data.script.word_count} words`;

    const sectionContainer = document.getElementById('cc-script-sections');
    sectionContainer.innerHTML = '';
    data.script.sections.forEach((section) => {
      sectionContainer.innerHTML += `
        <div class="script-section">
          <div class="section-label">${section.label.replace(/_/g, ' ')}</div>
          <p>${section.text}</p>
        </div>
      `;
    });

    document.getElementById('cc-full-script').textContent = data.script.full_script;
    resultCC.classList.remove('hidden');
  }

  btnCCVideo.addEventListener('click', async () => {
    btnCCVideo.querySelector('.btn-text').classList.add('hidden');
    btnCCVideo.querySelector('.loader').classList.remove('hidden');
    btnCCVideo.disabled = true;

    try {
      if (!currentCCPayload) return;
      const response = await fetch('/api/v1/agents/crash-course/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentCCPayload),
      });

      if (!response.ok) throw new Error('API Request Failed');

      const data = await response.json();

      resultCCVideo.classList.remove('hidden');
      videoMock.classList.add('hidden');
      videoPlayer.classList.add('hidden');

      if (data.video && data.video.video_url && data.video.video_url.startsWith('https://mock.')) {
        videoMock.querySelector('code').textContent = data.video.blob_path;
        videoMock.classList.remove('hidden');
      } else if (data.video && data.video.video_url) {
        videoPlayer.src = data.video.video_url;
        videoPlayer.classList.remove('hidden');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to generate video.');
    } finally {
      btnCCVideo.querySelector('.btn-text').classList.remove('hidden');
      btnCCVideo.querySelector('.loader').classList.add('hidden');
      btnCCVideo.disabled = false;
    }
  });

  const btnWI = document.getElementById('btn-wi');
  const resultWI = document.getElementById('wi-result');
  const formWI = document.getElementById('weekly-insights-form');

  formWI.addEventListener('submit', async (event) => {
    event.preventDefault();

    btnWI.querySelector('.btn-text').classList.add('hidden');
    btnWI.querySelector('.loader').classList.remove('hidden');
    btnWI.disabled = true;

    try {
      const selectedIndex = document.getElementById('wi-fixture-select').value;
      if (selectedIndex === '') {
        alert('Please wait for fixtures to load.');
        return;
      }

      const payload = fixtures.weeklyInsights[Number(selectedIndex)];
      const response = await fetch('/api/v1/agents/weekly-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('API Request Failed');

      const data = await response.json();
      renderWeeklyInsights(data);
    } catch (error) {
      console.error(error);
      alert('Failed to run Weekly Insights pipeline.');
    } finally {
      btnWI.querySelector('.btn-text').classList.remove('hidden');
      btnWI.querySelector('.loader').classList.add('hidden');
      btnWI.disabled = false;
    }
  });

  function renderWeeklyInsights(data) {
    document.getElementById('wi-attempts').textContent = `Validation Attempts: ${data.attempts}`;
    const recap = data.recap;

    document.getElementById('wi-main-topic').textContent = recap.main_character.topic;
    document.getElementById('wi-main-narrative').textContent = recap.main_character.narrative;
    document.getElementById('wi-main-stats').textContent = `+${Math.round(recap.main_character.mastery_delta * 100)}% Mastery`;

    document.getElementById('wi-flop-topic').textContent = recap.flop_era.topic;
    document.getElementById('wi-flop-narrative').textContent = recap.flop_era.narrative;
    document.getElementById('wi-flop-stats').textContent = `${Math.round(recap.flop_era.accuracy_rate * 100)}% Accuracy`;

    document.getElementById('wi-plot-twist').textContent = recap.plot_twist.insight;

    const questList = document.getElementById('wi-quest-list');
    questList.innerHTML = '';
    recap.weekly_quest.forEach((quest) => {
      questList.innerHTML += `
        <li>
          <strong>${quest.action}</strong>
          <span class="quest-rationale">${quest.rationale}</span>
        </li>
      `;
    });

    resultWI.classList.remove('hidden');

    if (data.summary_kpis) {
      const kpis = data.summary_kpis;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('wi-kpi-top-topic', kpis.top_topic);
      set('wi-kpi-top-gain', `+${Math.round(kpis.top_gain * 100)}%`);
      set('wi-kpi-accuracy', `${Math.round(kpis.accuracy_this_week * 100)}%`);
      set('wi-kpi-days-active', kpis.days_active);
      set('wi-kpi-sessions', kpis.sessions_count);
      set('wi-kpi-quests', kpis.quest_count);
      const kpiRow = document.getElementById('wi-summary-kpis');
      if (kpiRow) kpiRow.classList.remove('hidden');
    }
  }

});
