document.addEventListener('DOMContentLoaded', async () => {

    // --- State and Config ---
    let fixtures = { crashCourse: [], weeklyInsights: [] };

    // Fetch Fixtures on Load
    try {
        const res = await fetch('/api/v1/fixtures');
        if (res.ok) {
            fixtures = await res.json();
            populateDropdowns(fixtures);
        } else {
            console.error('Failed to load fixtures');
        }
    } catch (e) {
        console.error('API Error loading fixtures:', e);
    }

    function populateDropdowns(data) {
        const ccSelect = document.getElementById('cc-fixture-select');
        ccSelect.innerHTML = '';
        data.crashCourse.forEach((student, index) => {
            const displayName = `${student.student_id} - ${student.topic}: ${student.subtopic}`;
            ccSelect.innerHTML += `<option value="${index}">${displayName}</option>`;
        });

        const wiSelect = document.getElementById('wi-fixture-select');
        wiSelect.innerHTML = '';
        data.weeklyInsights.forEach((student, index) => {
            const displayName = `${student.student_id}`;
            wiSelect.innerHTML += `<option value="${index}">${displayName}</option>`;
        });
    }

    // --- Crash Course Logic ---
    const btnCC = document.getElementById('btn-cc');
    const resultCC = document.getElementById('cc-result');
    const formCC = document.getElementById('crash-course-form');

    formCC.addEventListener('submit', async (e) => {
        e.preventDefault();

        btnCC.querySelector('.btn-text').classList.add('hidden');
        btnCC.querySelector('.loader').classList.remove('hidden');
        btnCC.disabled = true;

        try {
            const selectedIndex = document.getElementById('cc-fixture-select').value;
            if (!selectedIndex) {
                alert('Please wait for fixtures to load.');
                return;
            }

            const payload = fixtures.crashCourse[selectedIndex];

            const response = await fetch('/api/v1/agents/crash-course', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('API Request Failed');

            const data = await response.json();
            renderCrashCourse(data);

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
        document.getElementById('cc-objective').textContent = data.sora_video_prompt?.video_objective || 'No objective provided';
        document.getElementById('cc-engine').textContent = data.sora_video_prompt?.engine || 'unknown';

        // Render Cards
        const cardsGrid = document.getElementById('cc-cards-container');
        cardsGrid.innerHTML = '';
        data.cards.forEach(card => {
            cardsGrid.innerHTML += `
                <div class="cc-card">
                    <div class="card-stage-label">${card.stage.replace('_', ' ')}</div>
                    <h4>${card.title}</h4>
                    <p>${card.body}</p>
                </div>
            `;
        });

        // Render Scenes
        const scenesContainer = document.getElementById('cc-scenes-container');
        scenesContainer.innerHTML = '';
        if (data.sora_video_prompt && Array.isArray(data.sora_video_prompt.scenes)) {
            data.sora_video_prompt.scenes.forEach(scene => {
                scenesContainer.innerHTML += `
                    <div class="scene-item">
                        <div class="scene-visual">🎥 Visual: ${scene.on_screen_visual}</div>
                        <p>🗣️ Narration: "${scene.narration_prompt}"</p>
                    </div>
                `;
            });
        } else {
            scenesContainer.innerHTML = '<p class="description">No video prompt generated in this response.</p>';
        }

        resultCC.classList.remove('hidden');
    }

    // --- Weekly Insights Logic ---
    const btnWI = document.getElementById('btn-wi');
    const resultWI = document.getElementById('wi-result');
    const formWI = document.getElementById('weekly-insights-form');

    formWI.addEventListener('submit', async (e) => {
        e.preventDefault();

        btnWI.querySelector('.btn-text').classList.add('hidden');
        btnWI.querySelector('.loader').classList.remove('hidden');
        btnWI.disabled = true;

        try {
            const selectedIndex = document.getElementById('wi-fixture-select').value;
            if (!selectedIndex) {
                alert('Please wait for fixtures to load.');
                return;
            }

            const payload = fixtures.weeklyInsights[selectedIndex];

            const response = await fetch('/api/v1/agents/weekly-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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

        // Main Character
        document.getElementById('wi-main-topic').textContent = recap.main_character.topic;
        document.getElementById('wi-main-narrative').textContent = recap.main_character.narrative;
        document.getElementById('wi-main-stats').textContent = `+${Math.round(recap.main_character.mastery_delta * 100)}% Mastery`;

        // Flop Era
        document.getElementById('wi-flop-topic').textContent = recap.flop_era.topic;
        document.getElementById('wi-flop-narrative').textContent = recap.flop_era.narrative;
        document.getElementById('wi-flop-stats').textContent = `${Math.round(recap.flop_era.accuracy_rate * 100)}% Accuracy`;

        // Plot Twist
        document.getElementById('wi-plot-twist').textContent = recap.plot_twist.insight;

        // Quests
        const questList = document.getElementById('wi-quest-list');
        questList.innerHTML = '';
        recap.weekly_quest.forEach(quest => {
            questList.innerHTML += `
                <li>
                    <strong>${quest.action}</strong>
                    <span class="quest-rationale">${quest.rationale}</span>
                </li>
            `;
        });

        resultWI.classList.remove('hidden');
    }
});
