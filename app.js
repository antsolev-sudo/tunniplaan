document.addEventListener('DOMContentLoaded', () => {
    
    // Exact times provided by the user for RRG (0th to 7th lesson)
    // Format: id: index (matches Untis json index usually if starting from 0)
    const schoolTimes = [
        { id: 0, start: '08:00', end: '08:40' },
        { id: 1, start: '08:45', end: '09:30' },
        { id: 2, start: '09:40', end: '10:25' },
        { id: 3, start: '10:50', end: '11:35' },
        { id: 4, start: '12:05', end: '12:50' },
        { id: 5, start: '13:00', end: '13:45' },
        { id: 6, start: '13:55', end: '14:40' },
        { id: 7, start: '14:50', end: '15:35' }
    ];

    const daysEstonian = [
        'Esmaspäev', 
        'Teisipäev', 
        'Kolmapäev', 
        'Neljapäev', 
        'Reede'
    ];

    // State
    let currentType = "class"; // class, teacher, room
    let currentEntity = "";
    
    // Real day index (0 = Monday). If weekend, default to Monday
    let realDayIndex = new Date().getDay() - 1; 
    if (realDayIndex < 0 || realDayIndex > 4) realDayIndex = 0; 
    let activeDayIndex = realDayIndex;

    // Element bindings
    const typeSelect = document.getElementById('type-select');
    const entitySelect = document.getElementById('entity-select');
    const dayTabs = document.querySelectorAll('.tab');
    const lessonList = document.getElementById('lesson-list');
    const currentDayTitle = document.getElementById('current-day-title');

    // 1. Check Data Availability
    if (typeof window.TIMETABLE_DATA === 'undefined') {
        showError("Andmebaasi ei leitud! Palun käivita andmete uuendamise skript `import_untis.py`.");
        return;
    }
    const classDB = window.TIMETABLE_DATA;
    const classesList = Object.keys(classDB).sort();
    
    if (classesList.length === 0) {
        showError("Andmebaas on tühi. Andmete laadimine ebaõnnestus.");
        return;
    }

    // 2. Build Dynamic Databases for Teachers and Rooms
    const teacherDB = {};
    const roomDB = {};

    classesList.forEach(className => {
        const classData = classDB[className];
        if (!classData || !classData.schedule) return;
        
        classData.schedule.forEach((daySchedule, dayIdx) => {
            if (!daySchedule) return;
            
            Object.keys(daySchedule).forEach(periodStr => {
                const period = parseInt(periodStr);
                const lessons = daySchedule[periodStr];
                
                lessons.forEach(lesson => {
                    const subj = lesson.subject;
                    const type = lesson.type;
                    
                    // Filter out junks
                    if (!subj || daysEstonian.includes(subj)) return;
                    
                    // Add to Teacher DB
                    if (lesson.teacher) {
                        const t = lesson.teacher;
                        if (!teacherDB[t]) teacherDB[t] = { schedule: [{}, {}, {}, {}, {}] };
                        if (!teacherDB[t].schedule[dayIdx][period]) teacherDB[t].schedule[dayIdx][period] = [];
                        
                        // Avoid exact duplicates if parallel class groups represent the same physical lesson
                        const exists = teacherDB[t].schedule[dayIdx][period].some(l => l.subject === subj && l.class === className);
                        if (!exists) {
                            teacherDB[t].schedule[dayIdx][period].push({
                                subject: subj,
                                class: className, // Store class name
                                room: lesson.room,
                                type: type
                            });
                        }
                    }
                    
                    // Add to Room DB
                    if (lesson.room) {
                        const r = lesson.room;
                        if (!roomDB[r]) roomDB[r] = { schedule: [{}, {}, {}, {}, {}] };
                        if (!roomDB[r].schedule[dayIdx][period]) roomDB[r].schedule[dayIdx][period] = [];
                        
                        const exists = roomDB[r].schedule[dayIdx][period].some(l => l.subject === subj && l.class === className);
                        if (!exists) {
                            roomDB[r].schedule[dayIdx][period].push({
                                subject: subj,
                                class: className, 
                                teacher: lesson.teacher,
                                type: type
                            });
                        }
                    }
                });
            });
        });
    });

    const teachersList = Object.keys(teacherDB).sort();
    const roomsList = Object.keys(roomDB).sort();

    // 3. Initialize Selectors
    function populateEntitySelect(type) {
        entitySelect.innerHTML = '';
        let list = [];
        if (type === 'class') list = classesList;
        else if (type === 'teacher') list = teachersList;
        else if (type === 'room') list = roomsList;

        if (list.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "Andmed puuduvad";
            entitySelect.appendChild(opt);
            return;
        }

        list.forEach(item => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = item;
            entitySelect.appendChild(opt);
        });
        
        currentEntity = list[0];
        entitySelect.value = currentEntity;
    }

    populateEntitySelect('class');

    typeSelect.addEventListener('change', (e) => {
        currentType = e.target.value;
        populateEntitySelect(currentType);
        renderTimeline();
    });

    entitySelect.addEventListener('change', (e) => {
        currentEntity = e.target.value;
        renderTimeline();
    });

    // 4. Initialize Day Tabs
    dayTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            dayTabs.forEach(t => t.classList.remove('active'));
            const targetLi = e.target.closest('.tab');
            targetLi.classList.add('active');
            activeDayIndex = parseInt(targetLi.getAttribute('data-day'));
            renderTimeline();
        });
    });
    
    // Set initial active tab based on activeDayIndex
    const initialActiveTab = document.querySelector(`.tab[data-day="${activeDayIndex}"]`);
    if (initialActiveTab) {
        initialActiveTab.classList.add('active');
    }

    // 5. Render Logic
    function renderTimeline() {
        let db;
        if (currentType === 'class') db = classDB;
        else if (currentType === 'teacher') db = teacherDB;
        else if (currentType === 'room') db = roomDB;
        
        const data = db[currentEntity];
        if (!data) return showError(`Valitud andmeid (${currentEntity}) ei leitud.`);

        // Update Title
        let dateStr = "";
        if (activeDayIndex === realDayIndex && currentType === 'class') dateStr = " (Täna)";
        currentDayTitle.innerHTML = `${daysEstonian[activeDayIndex]}${dateStr} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal; display:block; margin-top:0.2rem;">${currentType === 'class' ? 'Klass' : currentType === 'teacher' ? 'Õpetaja' : 'Ruum'} ${currentEntity}</span>`;

        const daySchedule = data.schedule[activeDayIndex] || {};
        lessonList.innerHTML = '';
        
        const activeSlots = Object.keys(daySchedule).map(Number);
        const maxSlot = Math.max(...activeSlots, 4);
        
        let hasLessonsToday = false;
        
        for (let slotIndex = 0; slotIndex < schoolTimes.length; slotIndex++) {
            const timeInfo = schoolTimes[slotIndex];
            const slotId = timeInfo.id;
            
            const groupsInSlot = daySchedule[slotId] || [];
            
            if (groupsInSlot.length > 0) {
                hasLessonsToday = true;
                
                const card = document.createElement('div');
                card.className = `lesson-card sub-${groupsInSlot[0].type}`;
                
                if (activeDayIndex === realDayIndex && isTimeCurrent(timeInfo.start, timeInfo.end)) {
                    card.classList.add('is-current');
                }
                
                let groupsHtml = '';
                groupsInSlot.forEach((grp, idx) => {
                    // Decide what to show based on context
                    let icon1 = '', text1 = '', icon2 = '', text2 = '';
                    
                    if (currentType === 'class') {
                        icon1 = 'person'; text1 = grp.teacher;
                        icon2 = 'room'; text2 = grp.room;
                    } else if (currentType === 'teacher') {
                        icon1 = 'group'; text1 = `Klass: ${grp.class}`;
                        icon2 = 'room'; text2 = grp.room;
                    } else if (currentType === 'room') {
                        icon1 = 'group'; text1 = `Klass: ${grp.class}`;
                        icon2 = 'person'; text2 = grp.teacher;
                    }

                    groupsHtml += `
                        <div class="group-info" style="${idx > 0 ? 'margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed rgba(255,255,255,0.1);' : ''}">
                            <h3 class="subject">${grp.subject}</h3>
                            <div class="details">
                                ${text1 ? `<span class="detail-item"><span class="material-icons-round">${icon1}</span> ${text1}</span>` : ''}
                                ${text2 ? `<span class="detail-item"><span class="material-icons-round">${icon2}</span> ${text2}</span>` : ''}
                            </div>
                        </div>
                    `;
                });

                card.innerHTML = `
                    <div class="time-column">
                        <div class="time-primary">${timeInfo.start}</div>
                        <div class="time-secondary">${timeInfo.end}</div>
                        <div class="lesson-number">${timeInfo.id}. tund</div>
                    </div>
                    <div class="info-column">
                        ${groupsHtml}
                    </div>
                `;
                lessonList.appendChild(card);
                
            } else {
                let shouldRender = false;
                if (slotId >= 1 && slotId <= 4) shouldRender = true;
                else if (slotId > 4 && slotId <= maxSlot) shouldRender = true;
                
                if (shouldRender) {
                    const emptyCard = document.createElement('div');
                    emptyCard.className = 'lesson-card is-empty';
                    emptyCard.innerHTML = `
                        <div class="time-column">
                            <div class="time-primary" style="opacity: 0.5;">${timeInfo.start}</div>
                            <div class="lesson-number">${timeInfo.id}. tund</div>
                        </div>
                        <div class="info-column">
                            <span class="free-period-text">Vaba tund</span>
                        </div>
                    `;
                    lessonList.appendChild(emptyCard);
                }
            }
        }

        if (!hasLessonsToday) {
            lessonList.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                    <span class="material-icons-round" style="font-size: 48px; margin-bottom: 1rem; opacity: 0.5;">sentiment_satisfied</span>
                    <p style="font-size: 1.1rem; font-weight: 500;">Sellel päeval tunde ei toimu!</p>
                </div>
            `;
        }
    }

    // Helper Functions
    function showError(msg) {
        document.querySelector('.timeline-container').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #ef4444;">
                <span class="material-icons-round" style="font-size: 48px; margin-bottom: 1rem;">error_outline</span>
                <p style="font-weight: 600;">${msg}</p>
            </div>
        `;
    }

    function isTimeCurrent(startStr, endStr) {
        const now = new Date();
        const curMinutes = now.getHours() * 60 + now.getMinutes();
        
        const parseTime = (str) => {
            const parts = str.split(/[:\.]/); // handles 08:45 or 08.45
            if (parts.length === 2) {
                return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return 0;
        };

        const sMap = parseTime(startStr);
        const eMap = parseTime(endStr);
        
        return curMinutes >= sMap && curMinutes <= eMap;
    }

    // Trigger first render
    renderTimeline();
});
