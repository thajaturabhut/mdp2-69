/* ==========================================================================
   MDP รุ่น 2/69 Online Yearbook - Application Logic
   Vanilla JavaScript SPA Architecture
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    members: [],
    gallery: [],
    currentFilter: 'all',
    searchQuery: '',
    activeMemberId: null
  };

  // 30-Day Session Configuration & Firebase State
  const SESSION_KEY = 'mdp269_session';
  const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days in Milliseconds
  
  let currentAuthData = {
    email: '',
    generatedOtp: null
  };

  // DOM Elements
  const elements = {
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.page-section'),
    mobileMenuToggle: document.getElementById('mobileMenuToggle'),
    mobileNavLinks: document.getElementById('navLinks'),
    membersGrid: document.getElementById('membersGrid'),
    memberCountBadge: document.getElementById('memberCountBadge'),
    searchInput: document.getElementById('searchInput'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    profileView: document.getElementById('profileView'),
    galleryGrid: document.getElementById('galleryGrid'),
    lightboxModal: document.getElementById('lightboxModal'),
    modalImg: document.getElementById('modalImg'),
    modalTitle: document.getElementById('modalTitle'),
    modalMeta: document.getElementById('modalMeta'),
    modalDesc: document.getElementById('modalDesc'),
    modalClose: document.getElementById('modalClose'),

    // Auth & Session Elements
    authModal: document.getElementById('authModal'),
    empIdForm: document.getElementById('empIdForm'),
    empIdInput: document.getElementById('empIdInput'),
    empIdNotice: document.getElementById('empIdNotice'),
    sessionNavContainer: document.getElementById('sessionNavContainer')
  };

  // Initialize App
  init();

  async function init() {
    setupEventListeners();
    await loadData();
    setupAuthListeners();
    checkSession();
    handleRouting();
    window.addEventListener('hashchange', handleRouting);
  }

  // Fetch JSON Data with Error Handling & Standalone Fallback
  async function loadData() {
    try {
      const [membersRes, galleryRes] = await Promise.all([
        fetch('data/members.json').then(res => res.json()),
        fetch('data/gallery.json').then(res => res.json())
      ]);

      state.members = membersRes;
      state.gallery = galleryRes;
    } catch (err) {
      console.warn('Unable to load json via fetch (possibly local file:// protocol), using built-in data fallback:', err);
      // Data fallback if running without HTTP server
      state.members = getFallbackMembers();
      state.gallery = getFallbackGallery();
    }

    renderMembers();
    renderGallery();
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Mobile Navigation Toggle
    if (elements.mobileMenuToggle) {
      elements.mobileMenuToggle.addEventListener('click', () => {
        elements.mobileNavLinks.classList.toggle('show');
      });
    }

    // Close mobile menu on link click
    elements.navLinks.forEach(link => {
      link.addEventListener('click', () => {
        elements.mobileNavLinks.classList.remove('show');
      });
    });

    // Search Input
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderMembers();
      });
    }

    // Filter Buttons
    elements.filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        elements.filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.currentFilter = e.target.dataset.filter;
        renderMembers();
      });
    });

    // Lightbox Close
    if (elements.modalClose) {
      elements.modalClose.addEventListener('click', closeLightbox);
    }
    if (elements.lightboxModal) {
      elements.lightboxModal.addEventListener('click', (e) => {
        if (e.target === elements.lightboxModal) closeLightbox();
      });
    }
  }

  // Client-side Hash Router with Protected Routes
  function handleRouting() {
    const hash = window.location.hash || '#home';
    const [path, queryString] = hash.split('?');

    let targetSectionId = 'home';
    if (path === '#members') targetSectionId = 'members';
    else if (path === '#profile') targetSectionId = 'profile';
    else if (path === '#gallery') targetSectionId = 'gallery';

    // Protect Executive-Only Routes (#members and #profile)
    if (targetSectionId === 'members' || targetSectionId === 'profile') {
      if (!hasValidSession()) {
        promptAuthModal('กรุณากรอกรหัสพนักงาน 8 หลัก เพื่อปลดล็อกเข้าดูข้อมูลสมาชิกรุ่น');
        // Prevent navigation to protected content if not authenticated
        return;
      }
    } else {
      // Public Pages (#home, #gallery) - Hide modal if open
      hideAuthModal();
    }

    // Highlight Navbar Link
    elements.navLinks.forEach(link => {
      const href = link.getAttribute('href').split('?')[0];
      if (href === path || (path === '#home' && href === '#home')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Handle Profile Route with ID parameter
    if (targetSectionId === 'profile' && queryString) {
      const urlParams = new URLSearchParams(queryString);
      const id = parseInt(urlParams.get('id'));
      if (id) {
        state.activeMemberId = id;
        renderProfile(id);
      }
    }

    // Switch Visible Section
    elements.sections.forEach(sec => {
      if (sec.id === targetSectionId) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Render Members Card Grid
  function renderMembers() {
    if (!elements.membersGrid) return;

    const filtered = state.members.filter(member => {
      const matchesSearch = 
        member.nameTh.toLowerCase().includes(state.searchQuery) ||
        member.nameEn.toLowerCase().includes(state.searchQuery) ||
        member.nickname.toLowerCase().includes(state.searchQuery) ||
        member.position.toLowerCase().includes(state.searchQuery) ||
        member.department.toLowerCase().includes(state.searchQuery) ||
        member.division.toLowerCase().includes(state.searchQuery);

      if (state.currentFilter === 'all') return matchesSearch;
      if (state.currentFilter === 'manager') return matchesSearch && member.position.includes('ผู้จัดการ');
      if (state.currentFilter === 'director') return matchesSearch && member.position.includes('ผู้อำนวยการ');
      if (state.currentFilter === 'tech') return matchesSearch && (member.position.includes('วิศวกร') || member.position.includes('ไซเบอร์') || member.position.includes('ดิจิทัล'));
      if (state.currentFilter === 'finance') return matchesSearch && (member.position.includes('บัญชี') || member.position.includes('การเงิน'));

      return matchesSearch;
    });

    if (elements.memberCountBadge) {
      elements.memberCountBadge.textContent = `แสดงผล ${filtered.length} จากสมาชิกทั้งหมด ${state.members.length} ท่าน`;
    }

    if (filtered.length === 0) {
      elements.membersGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
          <i class="fas fa-user-slash" style="font-size: 3rem; color: var(--brand-gold); margin-bottom: 1rem; opacity: 0.7;">
          </i>
          <h3>ไม่พบข้อมูลสมาชิกที่ตรงกับการค้นหา</h3>
          <p style="margin-top: 0.5rem;">ลองค้นหาด้วยคำอื่น เช่น ชื่อจริง ชื่อเล่น ตำแหน่ง หรือหน่วยงาน</p>
        </div>
      `;
      return;
    }

    elements.membersGrid.innerHTML = filtered.map(member => {
      const hasNickname = member.nickname && member.nickname !== '-';
      const nicknameDisplay = hasNickname ? `"${member.nickname}"` : `รหัส ${member.empId}`;

      return `
        <div class="member-card" onclick="window.location.hash='#profile?id=${member.id}'">
          <div class="member-card-header">
            <img src="${member.avatarUrl}" alt="${member.nameTh}" class="member-photo" loading="lazy" />
            <div class="no-badge">NO. ${member.no}</div>
          </div>
          <div class="member-card-body">
            <div class="member-name-group">
              <h3 class="member-name">${member.nameTh}</h3>
              <div class="member-nickname">${nicknameDisplay} &bull; ${member.nameEn}</div>
            </div>
            <div class="member-info-item">
              <i class="fas fa-briefcase"></i>
              <span>${member.position}</span>
            </div>
            <div class="member-info-item">
              <i class="fas fa-building"></i>
              <span>${member.department}</span>
            </div>
            <div class="member-card-footer">
              <span><i class="fas fa-id-card"></i> รหัส ${member.empId}</span>
              <span>ดูโปรไฟล์ <i class="fas fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Single Executive Profile View
  function renderProfile(id) {
    if (!elements.profileView) return;

    const member = state.members.find(m => m.id === id) || state.members[0];

    // Generate Strengths List
    const strengthsHtml = member.strengths ? member.strengths.map(s => `<li>${s}</li>`).join('') : '<li>วิเคราะห์เชิงลึก</li>';
    // Generate MDP Benefits List
    const benefitsHtml = member.mdpBenefits ? member.mdpBenefits.map(b => `<li>${b}</li>`).join('') : '<li>ทักษะภาวะผู้นำ</li>';

    elements.profileView.innerHTML = `
      <div class="profile-container">
        <div class="profile-top-bar">
          <button class="btn-back" onclick="window.location.hash='#members'">
            <i class="fas fa-arrow-left"></i> กลับไปหน้ารายชื่อสมาชิก
          </button>
          <div class="hero-pill" style="margin-bottom:0;">
            <i class="fas fa-award"></i> MDP รุ่น 2/69
          </div>
        </div>

        <div class="profile-layout">
          <!-- Left Sidebar -->
          <div class="profile-sidebar">
            <div class="profile-photo-wrapper">
              <span class="profile-no-badge">NO. ${member.no}</span>
              <img src="${member.avatarUrl}" alt="${member.nameTh}" class="profile-photo" />
            </div>
            
            <div class="contact-items" style="width: 100%; text-align: left; margin-top: 0.5rem;">
              <div class="contact-item">
                <div class="contact-icon"><i class="fas fa-phone-alt"></i></div>
                <div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">เบอร์โทรศัพท์</div>
                  <div style="font-weight: 600;">${member.phone}</div>
                </div>
              </div>
              <div class="contact-item">
                <div class="contact-icon"><i class="fas fa-envelope"></i></div>
                <div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">อีเมลองค์กร</div>
                  <div style="font-weight: 600;">${member.email}</div>
                </div>
              </div>
              <div class="contact-item">
                <div class="contact-icon"><i class="fab fa-line"></i></div>
                <div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">LINE ID</div>
                  <div style="font-weight: 600;">${member.lineId}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Content Body -->
          <div class="profile-main-content">
            <div class="profile-header-info">
              <h1 class="profile-name-th">${member.nameTh} <span class="text-gold">("${member.nickname}")</span></h1>
              <div class="profile-name-en">${member.nameEn}</div>
              
              <div class="profile-meta-pills">
                <div class="meta-pill">
                  <i class="fas fa-user-tie"></i>
                  <div>
                    <span class="meta-pill-label">ตำแหน่ง</span>
                    <span class="meta-pill-val">${member.position}</span>
                  </div>
                </div>
                <div class="meta-pill">
                  <i class="fas fa-sitemap"></i>
                  <div>
                    <span class="meta-pill-label">หน่วยงาน</span>
                    <span class="meta-pill-val">${member.department}</span>
                  </div>
                </div>
                <div class="meta-pill">
                  <i class="fas fa-layer-group"></i>
                  <div>
                    <span class="meta-pill-label">สังกัด</span>
                    <span class="meta-pill-val">${member.division}</span>
                  </div>
                </div>
                <div class="meta-pill">
                  <i class="fas fa-history"></i>
                  <div>
                    <span class="meta-pill-label">อายุงานกับ NT</span>
                    <span class="meta-pill-val">${member.workYears}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3 Columns Exec Blocks -->
            <div class="profile-blocks-grid">
              <div class="exec-block">
                <div class="exec-block-header">
                  <i class="fas fa-user-circle"></i> ABOUT ME
                </div>
                <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                  "${member.aboutMe}"
                </p>
              </div>

              <div class="exec-block">
                <div class="exec-block-header">
                  <i class="fas fa-star"></i> จุดเด่น (STRENGTHS)
                </div>
                <ul class="exec-list">
                  ${strengthsHtml}
                </ul>
              </div>

              <div class="exec-block">
                <div class="exec-block-header">
                  <i class="fas fa-gift"></i> สิ่งที่ได้รับจาก MDP
                </div>
                <ul class="exec-list">
                  ${benefitsHtml}
                </ul>
              </div>
            </div>

            <!-- Hobbies & Personal Interests -->
            ${member.hobbies ? `
              <div class="profile-contact-card">
                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; width: 100%;">
                  <div style="flex: 1; min-width: 140px;">
                    <div style="font-size: 0.8rem; color: var(--brand-green); font-weight: 700; margin-bottom: 0.2rem;"><i class="fas fa-bullseye" style="color: var(--brand-yellow);"></i> เป้าหมาย</div>
                    <div style="font-size: 0.9rem; color: var(--text-dark);">${member.hobbies.goal}</div>
                  </div>
                  <div style="flex: 1; min-width: 140px;">
                    <div style="font-size: 0.8rem; color: var(--brand-green); font-weight: 700; margin-bottom: 0.2rem;"><i class="fas fa-heart" style="color: var(--brand-yellow);"></i> แรงบันดาลใจ</div>
                    <div style="font-size: 0.9rem; color: var(--text-dark);">${member.hobbies.inspiration}</div>
                  </div>
                  <div style="flex: 1; min-width: 140px;">
                    <div style="font-size: 0.8rem; color: var(--brand-green); font-weight: 700; margin-bottom: 0.2rem;"><i class="fas fa-plane" style="color: var(--brand-yellow);"></i> สิ่งที่ชอบ</div>
                    <div style="font-size: 0.9rem; color: var(--text-dark);">${member.hobbies.favoriteThing}</div>
                  </div>
                  <div style="flex: 1; min-width: 140px;">
                    <div style="font-size: 0.8rem; color: var(--brand-green); font-weight: 700; margin-bottom: 0.2rem;"><i class="fas fa-music" style="color: var(--brand-yellow);"></i> เพลงโปรด</div>
                    <div style="font-size: 0.9rem; color: var(--text-dark);">${member.hobbies.favoriteSong}</div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Banner Quote -->
            <div class="banner-quote">
              "${member.quote}"
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render Activity Gallery Grid (Supports Multi-photo Albums)
  function renderGallery() {
    if (!elements.galleryGrid) return;

    elements.galleryGrid.innerHTML = state.gallery.map(item => {
      const photos = item.images || [item.imageUrl];
      const photoCount = photos.length;
      
      return `
        <div class="gallery-card" onclick="openLightbox(${item.id})">
          <div class="gallery-img-wrapper">
            <img src="${item.imageUrl}" alt="${item.title}" loading="lazy" />
            <div class="gallery-count-badge">
              <i class="fas fa-images"></i> ${photoCount} รูป
            </div>
            <div class="gallery-overlay">
              <div class="gallery-zoom-icon"><i class="fas fa-search-plus"></i></div>
            </div>
          </div>
          <div class="gallery-body">
            <div class="gallery-meta">
              <span class="gallery-cat">${item.category}</span>
              <span class="gallery-date"><i class="far fa-calendar-alt"></i> ${item.date}</span>
            </div>
            <h3 class="gallery-title">${item.title}</h3>
            <p class="gallery-desc">${item.description}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // Lightbox Handler for Photo Albums
  let currentAlbum = {
    photos: [],
    index: 0
  };

  window.openLightbox = function(id) {
    const item = state.gallery.find(g => g.id === id);
    if (!item || !elements.lightboxModal) return;

    currentAlbum.photos = item.images && item.images.length > 0 ? item.images : [item.imageUrl];
    currentAlbum.index = 0;

    elements.modalTitle.textContent = item.title;
    elements.modalMeta.textContent = `${item.category} • ${item.date}`;
    elements.modalDesc.textContent = item.description;

    updateModalPhoto();
    elements.lightboxModal.classList.add('active');
  };

  function updateModalPhoto() {
    if (!currentAlbum.photos.length) return;

    const currentUrl = currentAlbum.photos[currentAlbum.index];
    const total = currentAlbum.photos.length;

    elements.modalImg.style.opacity = '0.3';
    setTimeout(() => {
      elements.modalImg.src = currentUrl;
      elements.modalImg.style.opacity = '1';
    }, 150);

    const counterElem = document.getElementById('modalPhotoCounter');
    if (counterElem) {
      counterElem.textContent = `${currentAlbum.index + 1} / ${total}`;
    }

    // Toggle navigation arrows visibility
    const prevBtn = document.getElementById('modalPrev');
    const nextBtn = document.getElementById('modalNext');
    if (prevBtn) prevBtn.style.display = total > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = total > 1 ? 'flex' : 'none';

    // Render Thumbnails
    const thumbsContainer = document.getElementById('modalThumbnails');
    if (thumbsContainer) {
      if (total <= 1) {
        thumbsContainer.style.display = 'none';
      } else {
        thumbsContainer.style.display = 'flex';
        thumbsContainer.innerHTML = currentAlbum.photos.map((url, idx) => `
          <div class="thumb-item ${idx === currentAlbum.index ? 'active' : ''}" onclick="selectAlbumPhoto(${idx})">
            <img src="${url}" alt="Thumbnail ${idx + 1}" />
          </div>
        `).join('');
      }
    }
  }

  window.selectAlbumPhoto = function(idx) {
    currentAlbum.index = idx;
    updateModalPhoto();
  };

  function nextPhoto() {
    if (currentAlbum.photos.length <= 1) return;
    currentAlbum.index = (currentAlbum.index + 1) % currentAlbum.photos.length;
    updateModalPhoto();
  }

  function prevPhoto() {
    if (currentAlbum.photos.length <= 1) return;
    currentAlbum.index = (currentAlbum.index - 1 + currentAlbum.photos.length) % currentAlbum.photos.length;
    updateModalPhoto();
  }

  // Setup Next/Prev Event Listeners
  const prevBtn = document.getElementById('modalPrev');
  const nextBtn = document.getElementById('modalNext');
  if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevPhoto(); });
  if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextPhoto(); });

  // Keyboard Arrow Navigation
  document.addEventListener('keydown', (e) => {
    if (elements.lightboxModal && elements.lightboxModal.classList.contains('active')) {
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') closeLightbox();
    }
  });

  function closeLightbox() {
    if (elements.lightboxModal) {
      elements.lightboxModal.classList.remove('active');
    }
  }

  // Fallback Data for Local Standalone Execution without Server
  function getFallbackMembers() {
    return [
      {
        "id": 17,
        "no": 17,
        "nameTh": "จตุรภัทร อิ่มวุฒิ",
        "nameEn": "JATURABHUT IMWUT",
        "nickname": "พัท",
        "position": "ผู้จัดการส่วนพัฒนาประสบการณ์ลูกค้า",
        "department": "ส่วนพัฒนาประสบการณ์ลูกค้า",
        "division": "ฝ่ายกลยุทธ์การตลาดและประสบการณ์ลูกค้า",
        "workYears": "7 ปี",
        "phone": "088-123-4567",
        "email": "jaturapat.w@ntplc.co.th",
        "lineId": "pat_jaturapat",
        "quote": "อย่ารอให้โอกาสมาหา แต่จงสร้างโอกาสด้วยตัวเอง",
        "aboutMe": "ชอบเรียนรู้สิ่งใหม่ มุ่งมั่นพัฒนางานและตนเอง พร้อมส่งต่อประสบการณ์และทำงานร่วมกับผู้อื่นเพื่อเติบโตไปด้วยกัน",
        "strengths": ["วิเคราะห์เชิงลึก", "ประสานงานเก่ง", "บริหารเวลาได้ดี"],
        "mdpBenefits": ["มุมมองที่กว้างขึ้น", "ทักษะภาวะผู้นำ", "เครือข่ายที่มีคุณค่า"],
        "hobbies": { "goal": "นำประสบการณ์ MDP ไปขับเคลื่อนองค์กร", "inspiration": "ครอบครัวและทีมงาน", "favoriteThing": "เดินทางท่องเที่ยว", "favoriteSong": "Live & Learn" },
        "avatarUrl": "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80"
      }
    ];
  }

  function getFallbackGallery() {
    return [
      {
        "id": 1,
        "title": "พิธีเปิดการอบรมหลักสูตร MDP รุ่น 2/69",
        "category": "พิธีการ",
        "date": "15 มีนาคม 2569",
        "imageUrl": "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1000&q=80",
        "description": "คณะผู้บริหารเข้าร่วมพิธีเปิดหลักสูตร Management Development Program รุ่น 2/69 อย่างเป็นทางการ"
      }
    ];
  }

  // ==========================================================================
  // 30-Day Session Manager & 8-Digit Employee ID Authentication
  // ==========================================================================
  function hasValidSession() {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) return false;

    try {
      const session = JSON.parse(rawSession);
      const now = Date.now();

      if (now < session.expiresAt) {
        const remainingDays = Math.ceil((session.expiresAt - now) / (1000 * 60 * 60 * 24));
        renderSessionNav(session.empId, session.nameTh, remainingDays);
        return true;
      } else {
        localStorage.removeItem(SESSION_KEY);
        renderSessionNavClear();
        return false;
      }
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      renderSessionNavClear();
      return false;
    }
  }

  function checkSession() {
    return hasValidSession();
  }

  function renderSessionNav(empId, nameTh, remainingDays) {
    if (!elements.sessionNavContainer) return;
    const shortName = nameTh ? nameTh.split(' ')[0] : `รหัส ${empId}`;
    elements.sessionNavContainer.innerHTML = `
      <div class="user-session-pill">
        <i class="fas fa-user-check"></i>
        <span>${shortName} (${empId}) &bull; จำอีก ${remainingDays} วัน</span>
        <button class="btn-logout" onclick="window.logoutUser()">ออก</button>
      </div>
    `;
  }

  window.logoutUser = function() {
    localStorage.removeItem(SESSION_KEY);
    renderSessionNavClear();
    window.location.hash = '#home';
  };

  function renderSessionNavClear() {
    if (elements.sessionNavContainer) {
      elements.sessionNavContainer.innerHTML = '';
    }
  }

  function promptAuthModal(msg) {
    if (!elements.authModal) return;
    elements.authModal.classList.add('active');
    if (msg && elements.empIdNotice) {
      showNotice(elements.empIdNotice, msg, 'success');
    }
  }

  function hideAuthModal() {
    if (elements.authModal) {
      elements.authModal.classList.remove('active');
    }
  }

  function setupAuthListeners() {
    if (elements.empIdForm) {
      elements.empIdForm.addEventListener('submit', handleEmpIdSubmit);
    }
  }

  function handleEmpIdSubmit(e) {
    e.preventDefault();
    const enteredEmpId = elements.empIdInput.value.trim();

    if (!enteredEmpId) {
      showNotice(elements.empIdNotice, 'กรุณากรอกรหัสพนักงาน 8 หลัก', 'error');
      return;
    }

    // Match against member list empId
    const matchedMember = state.members.find(m => m.empId && m.empId.toString().trim() === enteredEmpId);

    if (!matchedMember && state.members.length > 0) {
      showNotice(elements.empIdNotice, 'รหัสพนักงานไม่ถูกต้อง หรือไม่อยู่ในรายชื่อสมาชิกรุ่น MDP 2/69 (48 ท่าน)', 'error');
      return;
    }

    const memberName = matchedMember ? matchedMember.nameTh : 'สมาชิกรุ่น MDP 2/69';

    // Save 30-Day Session
    const sessionObj = {
      empId: enteredEmpId,
      nameTh: memberName,
      loginTime: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
      authenticated: true
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionObj));

    showNotice(elements.empIdNotice, `ยินดีต้อนรับ ${memberName}! ปลดล็อกข้อมูลสมาชิกรุ่น 30 วันสำเร็จ...`, 'success');

    setTimeout(() => {
      hideAuthModal();
      checkSession();
      handleRouting();
    }, 600);
  }

  function showNotice(elem, msg, type) {
    if (!elem) return;
    elem.textContent = msg;
    elem.className = `auth-notice ${type}`;
    elem.style.display = 'block';
  }
});

