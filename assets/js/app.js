/**
 * Stackly - Main Application Logic
 * Pure Vanilla JavaScript ES6+
 */

document.addEventListener('DOMContentLoaded', () => {
  // Clear forms when page is shown from navigation / back-forward cache (bfcache)
  window.addEventListener('pageshow', () => {
    const nEmail = document.getElementById('newsletterEmail');
    const fEmail = document.getElementById('footerNewsletterEmail');
    if (nEmail) nEmail.value = '';
    if (fEmail) fEmail.value = '';
  });

  // --- App State ---
  const state = {
    destinations: STACKLY_DATA.destinations,
    hotels: STACKLY_DATA.hotels,
    promotions: STACKLY_DATA.promotions,
    testimonials: STACKLY_DATA.testimonials,

    // Filters & Sorting
    destinationFilter: 'all',
    hotelTypeFilter: 'all',
    hotelSortBy: 'popular',
    maxPrice: 600,
    searchKeyword: '',

    // Search & Estimation
    checkInDate: '',
    checkOutDate: '',
    guests: {
      adults: 2,
      children: 0,
      rooms: 1
    },

    // Slider
    currentSlide: 0,
    slideInterval: null,

    // Wishlist (LocalStorage)
    wishlist: JSON.parse(localStorage.getItem('stackly_wishlist') || '[]')
  };

  // --- Initialize Components ---
  initNavigation();
  initDateValidation();
  initGuestSelector();
  initHeroSearch();
  renderDestinations();
  initDestinationFilters();
  renderHotels();
  initHotelControls();
  renderOffers();
  renderTestimonialSlider();
  initNewsletterForm();
  initWishlistDrawer();
  updateWishlistUI();
  updatePriceEstimate();

  // Initialize AOS with repeat animations on scroll
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 850,
      easing: 'ease-out-cubic',
      once: false,      // Animates every time you scroll up and down!
      mirror: true,     // Elements animate out while scrolling past them and animate back in
      offset: 80,       // Trigger animation 80px before element enters viewport
      anchorPlacement: 'top-bottom'
    });
  }

  // =========================================================================
  // 1. Navigation & Header Scroll Behavior (with Active Spy)
  // =========================================================================
  function initNavigation() {
    const header = document.querySelector('.header');
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id], footer[id]');

    // Scroll active link update (ScrollSpy)
    function updateActiveNav() {
      const scrollY = window.scrollY;

      // Header sticky glassmorphism style
      if (scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }

      // Check which section is in viewport
      let currentSectionId = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        const sectionHeight = section.offsetHeight;
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
          currentSectionId = section.getAttribute('id');
        }
      });

      // Special case: bottom of the page
      if ((window.innerHeight + scrollY) >= document.body.offsetHeight - 50) {
        const lastSection = sections[sections.length - 1];
        if (lastSection) currentSectionId = lastSection.getAttribute('id');
      }

      if (currentSectionId) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${currentSectionId}`) {
            link.classList.add('active');
          }
        });
      }
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav(); // Initial call

    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('open');
        document.body.classList.toggle('nav-locked', isOpen);
        document.documentElement.classList.toggle('nav-locked', isOpen);
        const icon = navToggle.querySelector('i');
        if (icon) {
          icon.classList.toggle('fa-bars', !isOpen);
          icon.classList.toggle('fa-xmark', isOpen);
        }
      });

      // Close menu and set active on link click
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          navMenu.classList.remove('open');
          document.body.classList.remove('nav-locked');
          document.documentElement.classList.remove('nav-locked');
          const icon = navToggle.querySelector('i');
          if (icon) {
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-xmark');
          }
        });
      });
    }
  }

  // =========================================================================
  // 2. Date Pickers & Validation
  // =========================================================================
  function initDateValidation() {
    const checkInInput = document.getElementById('searchCheckIn');
    const checkOutInput = document.getElementById('searchCheckOut');

    if (!checkInInput || !checkOutInput) return;

    // Set today as minimum check-in date
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const formatDate = (d) => d.toISOString().split('T')[0];

    checkInInput.min = formatDate(today);
    checkInInput.value = formatDate(today);

    checkOutInput.min = formatDate(tomorrow);
    checkOutInput.value = formatDate(tomorrow);

    state.checkInDate = checkInInput.value;
    state.checkOutDate = checkOutInput.value;

    checkInInput.addEventListener('change', (e) => {
      const selectedCheckIn = new Date(e.target.value);
      const nextDay = new Date(selectedCheckIn);
      nextDay.setDate(selectedCheckIn.getDate() + 1);

      checkOutInput.min = formatDate(nextDay);
      if (new Date(checkOutInput.value) <= selectedCheckIn) {
        checkOutInput.value = formatDate(nextDay);
      }

      state.checkInDate = e.target.value;
      state.checkOutDate = checkOutInput.value;
      updatePriceEstimate();
    });

    checkOutInput.addEventListener('change', (e) => {
      if (new Date(e.target.value) <= new Date(checkInInput.value)) {
        showToast('Check-out date must be after check-in date', 'warning');
        const nextDay = new Date(checkInInput.value);
        nextDay.setDate(nextDay.getDate() + 1);
        checkOutInput.value = formatDate(nextDay);
      }
      state.checkOutDate = checkOutInput.value;
      updatePriceEstimate();
    });
  }

  // =========================================================================
  // 3. Guest & Room Selection Popover
  // =========================================================================
  function initGuestSelector() {
    const trigger = document.getElementById('guestSelectTrigger');
    const popover = document.getElementById('guestPopover');
    const displaySpan = document.getElementById('guestDisplayValue');

    if (!trigger || !popover) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !trigger.contains(e.target)) {
        popover.classList.remove('active');
      }
    });

    // Handle counter buttons (+ / -)
    const counterButtons = popover.querySelectorAll('.counter-btn');
    counterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const action = btn.dataset.action;
        const valueSpan = popover.querySelector(`.counter-value[data-type="${type}"]`);

        let currentVal = state.guests[type];
        if (action === 'plus') {
          if (type === 'adults' && currentVal < 10) currentVal++;
          if (type === 'children' && currentVal < 6) currentVal++;
          if (type === 'rooms' && currentVal < 5) currentVal++;
        } else if (action === 'minus') {
          if (type === 'adults' && currentVal > 1) currentVal--;
          if (type === 'children' && currentVal > 0) currentVal--;
          if (type === 'rooms' && currentVal > 1) currentVal--;
        }

        state.guests[type] = currentVal;
        valueSpan.textContent = currentVal;

        // Update button disabled state
        const minusBtn = popover.querySelector(`.counter-btn[data-type="${type}"][data-action="minus"]`);
        if (minusBtn) {
          minusBtn.disabled = (type === 'adults' || type === 'rooms') ? currentVal <= 1 : currentVal <= 0;
        }

        // Update display text
        const totalGuests = state.guests.adults + state.guests.children;
        displaySpan.textContent = `${totalGuests} Guest${totalGuests > 1 ? 's' : ''}, ${state.guests.rooms} Room${state.guests.rooms > 1 ? 's' : ''}`;

        updatePriceEstimate();
      });
    });
  }

  // =========================================================================
  // 4. Hero Destination Search & Live Estimate
  // =========================================================================
  function initHeroSearch() {
    const searchForm = document.getElementById('heroSearchForm');
    const destinationInput = document.getElementById('searchDestination');
    const checkInInput = document.getElementById('searchCheckIn');
    const checkOutInput = document.getElementById('searchCheckOut');
    const guestDisplay = document.getElementById('guestDisplayValue');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Collect search params
        const dest = destinationInput ? destinationInput.value.trim() : '';
        const checkIn = checkInInput ? checkInInput.value : '';
        const checkOut = checkOutInput ? checkOutInput.value : '';
        const guestsText = guestDisplay ? guestDisplay.textContent.trim() : '';

        // Redirect directly to the 404 page with query parameters
        const queryParams = new URLSearchParams({
          dest: dest || 'All Destinations',
          in: checkIn,
          out: checkOut,
          guests: guestsText
        });

        window.location.href = `404.html?${queryParams.toString()}`;
      });
    }

    if (destinationInput) {
      destinationInput.addEventListener('input', (e) => {
        state.searchKeyword = e.target.value.trim().toLowerCase();
        updatePriceEstimate();
      });
    }
  }

  // Dynamic booking price calculation
  function updatePriceEstimate() {
    const estimateBox = document.getElementById('livePriceEstimate');
    if (!estimateBox) return;

    const inDate = new Date(state.checkInDate || Date.now());
    const outDate = new Date(state.checkOutDate || (Date.now() + 86400000));
    const timeDiff = outDate.getTime() - inDate.getTime();
    const nights = Math.max(1, Math.round(timeDiff / (1000 * 3600 * 24)));

    // Average price based on filter or general baseline (~$230/night)
    const baseNightlyRate = 220;
    const roomsMultiplier = state.guests.rooms || 1;
    const estimatedTotal = nights * baseNightlyRate * roomsMultiplier;

    estimateBox.innerHTML = `
      <div class="estimate-details">
        <i class="fa-solid fa-calculator" style="color: var(--accent);"></i>
        <span><strong>${nights} Night${nights > 1 ? 's' : ''}</strong> (${state.guests.rooms} Room${state.guests.rooms > 1 ? 's' : ''}, ${state.guests.adults + state.guests.children} Guests)</span>
      </div>
      <div>
        <span style="font-size:0.85rem; color:var(--text-muted); margin-right:8px;">Estimated From:</span>
        <span class="estimate-price">$${estimatedTotal.toLocaleString()}</span>
      </div>
    `;
  }

  // =========================================================================
  // 5. Popular Destinations Rendering & Category Filters
  // =========================================================================
  function renderDestinations() {
    const container = document.getElementById('destinationsGrid');
    if (!container) return;

    const filtered = state.destinations.filter(d => {
      if (state.destinationFilter === 'all') return true;
      return d.category === state.destinationFilter;
    });

    container.innerHTML = filtered.map((dest, idx) => {
      // 2 cards come from the left (fade-right), 2 cards come from the right (fade-left)
      const animationType = (idx % 4 < 2) ? 'fade-right' : 'fade-left';
      const delay = (idx % 2) * 150;

      return `
      <div class="destination-card" data-aos="${animationType}" data-aos-delay="${delay}" data-aos-duration="900" onclick="handleDestinationClick('${dest.name}')">
        <img src="${dest.image}" alt="${dest.name}" loading="lazy">
        <div class="card-badge-top">
          <span class="badge badge-gold">${dest.badge}</span>
        </div>
        <div class="destination-overlay-content">
          <div class="destination-location">
            <i class="fa-solid fa-location-dot"></i> ${dest.country}
          </div>
          <h3 class="destination-name">${dest.name}</h3>
          <p class="destination-tagline">${dest.tagline}</p>
          <div class="destination-bottom-row">
            <div class="destination-price">
              <span>Starts from</span><br>
              <strong>$${dest.priceFrom}</strong> <span style="font-size:0.8rem">/night</span>
            </div>
            <div class="destination-rating">
              <i class="fa-solid fa-star"></i>
              <span>${dest.rating}</span>
              <span style="color: rgba(255,255,255,0.7); font-size: 0.75rem;">(${dest.reviewsCount})</span>
            </div>
          </div>
        </div>
      </div>
    `;
    }).join('');

    if (typeof AOS !== 'undefined') {
      AOS.refresh();
    }
  }

  function initDestinationFilters() {
    const filterButtons = document.querySelectorAll('.dest-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.destinationFilter = btn.dataset.filter;
        renderDestinations();
      });
    });
  }

  window.handleDestinationClick = function (destName) {
    const destInput = document.getElementById('searchDestination');
    if (destInput) {
      destInput.value = destName;
      state.searchKeyword = destName.toLowerCase();
    }
    const hotelsSection = document.getElementById('hotels');
    if (hotelsSection) {
      hotelsSection.scrollIntoView({ behavior: 'smooth' });
    }
    filterAndRenderHotels();
    showToast(`Showing hotels in and around ${destName}`, 'info');
  };

  // =========================================================================
  // 6. Featured Hotels Rendering, Filtering, Sorting & Wishlist
  // =========================================================================
  function renderHotels() {
    filterAndRenderHotels();
  }

  function filterAndRenderHotels() {
    const container = document.getElementById('hotelsGrid');
    const resultsCount = document.getElementById('hotelsResultsCount');
    if (!container) return;

    let list = [...state.hotels];

    // Filter by Keyword (City, Hotel Name, or Country)
    if (state.searchKeyword) {
      list = list.filter(h =>
        h.name.toLowerCase().includes(state.searchKeyword) ||
        h.city.toLowerCase().includes(state.searchKeyword) ||
        h.country.toLowerCase().includes(state.searchKeyword) ||
        h.description.toLowerCase().includes(state.searchKeyword)
      );
    }

    // Filter by Type
    if (state.hotelTypeFilter !== 'all') {
      list = list.filter(h => h.type.toLowerCase() === state.hotelTypeFilter.toLowerCase());
    }

    // Filter by Max Price
    list = list.filter(h => h.pricePerNight <= state.maxPrice);

    // Sorting functionality
    if (state.hotelSortBy === 'price-low') {
      list.sort((a, b) => a.pricePerNight - b.pricePerNight);
    } else if (state.hotelSortBy === 'price-high') {
      list.sort((a, b) => b.pricePerNight - a.pricePerNight);
    } else if (state.hotelSortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    } else {
      // Default: Popularity (reviews count * rating)
      list.sort((a, b) => (b.reviewsCount * b.rating) - (a.reviewsCount * a.rating));
    }

    if (resultsCount) {
      resultsCount.textContent = `Showing ${list.length} luxury stays`;
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="no-results-found" data-aos="fade-up">
          <i class="fa-solid fa-hotel"></i>
          <h3 style="font-size:1.4rem; margin-bottom:8px;">No accommodations match your criteria</h3>
          <p style="color:var(--text-muted); margin-bottom:20px;">Try adjusting your price slider or searching for a different destination.</p>
          <button class="btn btn-primary btn-sm" onclick="resetHotelFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((hotel, idx) => {
      const isWishlisted = state.wishlist.some(item => item.id === hotel.id);
      // Alternate left & right animation for hotel cards
      const animationType = (idx % 2 === 0) ? 'fade-right' : 'fade-left';
      const delay = (idx % 3) * 100;

      return `
        <div class="hotel-card" data-aos="${animationType}" data-aos-delay="${delay}" data-aos-duration="850">
          <div class="hotel-img-wrapper">
            <img src="${hotel.image}" alt="${hotel.name}" loading="lazy">
            <div class="hotel-badge-floating">
              <span class="badge badge-gold">${hotel.badge}</span>
            </div>
            <button class="hotel-wishlist-btn ${isWishlisted ? 'active' : ''}" 
                    title="${isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}"
                    onclick="toggleWishlist('${hotel.id}')">
              <i class="${isWishlisted ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}"></i>
            </button>
          </div>
          
          <div class="hotel-content">
            <div class="hotel-header-meta">
              <div class="hotel-location">
                <i class="fa-solid fa-location-dot"></i> ${hotel.city}, ${hotel.country}
              </div>
              <div class="hotel-rating-box">
                <i class="fa-solid fa-star"></i> ${hotel.rating}
                <span style="font-size:0.75rem; color:#78350f;">(${hotel.reviewsCount})</span>
              </div>
            </div>

            <h3 class="hotel-title">${hotel.name}</h3>
            <p class="hotel-desc">${hotel.description}</p>

            <div class="hotel-amenities-tags">
              ${hotel.amenities.slice(0, 3).map(a => `<span class="amenity-tag">${a}</span>`).join('')}
              ${hotel.amenities.length > 3 ? `<span class="amenity-tag">+${hotel.amenities.length - 3} more</span>` : ''}
            </div>

            <div class="hotel-footer-pricing">
              <div class="price-box">
                <span class="original-price">$${hotel.originalPrice}</span>
                <span class="price-night">$${hotel.pricePerNight}</span>
                <span class="period">/ night</span>
              </div>
              <button class="btn btn-dark btn-sm" onclick="handleBookHotel('${hotel.id}')">
                Book Stay <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (typeof AOS !== 'undefined') {
      AOS.refresh();
    }
  }

  function initHotelControls() {
    const sortSelect = document.getElementById('hotelSortSelect');
    const typeSelect = document.getElementById('hotelTypeSelect');
    const priceSlider = document.getElementById('priceRangeSlider');
    const priceDisplay = document.getElementById('priceRangeValue');

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.hotelSortBy = e.target.value;
        filterAndRenderHotels();
      });
    }

    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        state.hotelTypeFilter = e.target.value;
        if (state.hotelTypeFilter === 'all') {
          state.searchKeyword = ''; // Reset search keyword when user selects All Property Types
        }
        filterAndRenderHotels();
      });
    }

    if (priceSlider && priceDisplay) {
      priceSlider.addEventListener('input', (e) => {
        state.maxPrice = parseInt(e.target.value, 10);
        priceDisplay.textContent = `$${state.maxPrice}`;
        filterAndRenderHotels();
      });
    }
  }

  window.resetHotelFilters = function () {
    state.searchKeyword = '';
    state.hotelTypeFilter = 'all';
    state.hotelSortBy = 'popular';
    state.maxPrice = 600;

    const destInput = document.getElementById('searchDestination');
    if (destInput) destInput.value = '';

    const typeSelect = document.getElementById('hotelTypeSelect');
    if (typeSelect) typeSelect.value = 'all';

    const sortSelect = document.getElementById('hotelSortSelect');
    if (sortSelect) sortSelect.value = 'popular';

    const priceSlider = document.getElementById('priceRangeSlider');
    const priceDisplay = document.getElementById('priceRangeValue');
    if (priceSlider) priceSlider.value = 600;
    if (priceDisplay) priceDisplay.textContent = '$600';

    filterAndRenderHotels();
    showToast('Filters have been reset', 'info');
  };

  window.handleBookHotel = function (hotelId) {
    const hotel = state.hotels.find(h => h.id === hotelId);
    const destName = hotel ? `${hotel.name}, ${hotel.city}` : 'Luxury Stay';
    const checkIn = state.checkInDate || '';
    const checkOut = state.checkOutDate || '';
    const guestsText = `${state.guests.adults + state.guests.children} Guests, ${state.guests.rooms} Room(s)`;

    const queryParams = new URLSearchParams({
      dest: destName,
      in: checkIn,
      out: checkOut,
      guests: guestsText
    });

    window.location.href = `404.html?${queryParams.toString()}`;
  };

  // =========================================================================
  // 7. Wishlist Functionality (LocalStorage)
  // =========================================================================
  window.toggleWishlist = function (hotelId) {
    const hotel = state.hotels.find(h => h.id === hotelId);
    if (!hotel) return;

    const existingIdx = state.wishlist.findIndex(item => item.id === hotelId);
    if (existingIdx > -1) {
      state.wishlist.splice(existingIdx, 1);
      showToast(`Removed "${hotel.name}" from your wishlist`, 'info');
    } else {
      state.wishlist.push(hotel);
      showToast(`Added "${hotel.name}" to your wishlist!`, 'success');
    }

    localStorage.setItem('stackly_wishlist', JSON.stringify(state.wishlist));
    updateWishlistUI();
    filterAndRenderHotels();
  };

  function updateWishlistUI() {
    const badges = document.querySelectorAll('.wishlist-count-badge');
    const count = state.wishlist.length;

    badges.forEach(badge => {
      badge.textContent = count;
      if (count > 0) {
        badge.classList.add('visible');
      } else {
        badge.classList.remove('visible');
      }
    });

    renderWishlistDrawerItems();
  }

  function renderWishlistDrawerItems() {
    const container = document.getElementById('wishlistItemsContainer');
    if (!container) return;

    if (state.wishlist.length === 0) {
      container.innerHTML = `
        <div class="wishlist-empty-state">
          <i class="fa-regular fa-heart"></i>
          <h4>Your wishlist is empty</h4>
          <p>Tap the heart icon on any hotel card to save your dream stays here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="wishlist-items-list">
        ${state.wishlist.map(hotel => `
          <div class="wishlist-item">
            <img src="${hotel.image}" alt="${hotel.name}" class="wishlist-item-img">
            <div class="wishlist-item-details">
              <h5 class="wishlist-item-title">${hotel.name}</h5>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">
                <i class="fa-solid fa-location-dot"></i> ${hotel.city}, ${hotel.country}
              </div>
              <div class="wishlist-item-price">$${hotel.pricePerNight} <span style="font-weight:400; font-size:0.75rem; color:var(--text-muted);">/ night</span></div>
            </div>
            <button class="btn-remove-wishlist" onclick="toggleWishlist('${hotel.id}')" title="Remove">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function initWishlistDrawer() {
    const trigger = document.getElementById('openWishlistBtn');
    const drawerOverlay = document.getElementById('wishlistModal');
    const closeBtn = document.getElementById('closeWishlistBtn');

    if (trigger && drawerOverlay) {
      trigger.addEventListener('click', () => {
        drawerOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (closeBtn && drawerOverlay) {
      closeBtn.addEventListener('click', () => {
        drawerOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) {
          drawerOverlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  }

  // =========================================================================
  // 8. Special Offers & Coupon Code Copy
  // =========================================================================
  function renderOffers() {
    const container = document.getElementById('offersGrid');
    if (!container) return;

    container.innerHTML = state.promotions.map((offer, idx) => {
      // Alternate left & right animation for special offers
      const animationType = (idx % 2 === 0) ? 'fade-right' : 'fade-left';
      const delay = (idx % 3) * 120;

      return `
      <div class="offer-card" data-aos="${animationType}" data-aos-delay="${delay}" data-aos-duration="900">
        <div class="offer-img-box">
          <img src="${offer.image}" alt="${offer.title}" loading="lazy">
          <div class="offer-discount-tag">${offer.discount}</div>
        </div>
        <div class="offer-body">
          <div class="offer-validity">
            <i class="fa-regular fa-clock"></i> ${offer.validUntil}
          </div>
          <h3 class="offer-title">${offer.title}</h3>
          <p class="offer-desc">${offer.description}</p>
          
          <div class="coupon-container">
            <span class="coupon-code-text" id="coupon-${offer.id}">${offer.code}</span>
            <button class="btn-copy-coupon" onclick="copyCouponCode('${offer.code}', this)">
              <i class="fa-regular fa-copy"></i> Copy Code
            </button>
          </div>
        </div>
      </div>
    `;
    }).join('');

    if (typeof AOS !== 'undefined') {
      AOS.refresh();
    }
  }

  window.copyCouponCode = function (code, buttonElement) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        handleCopySuccess(buttonElement, code);
      }).catch(() => {
        fallbackCopy(code, buttonElement);
      });
    } else {
      fallbackCopy(code, buttonElement);
    }
  };

  function fallbackCopy(text, buttonElement) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    handleCopySuccess(buttonElement, text);
  }

  function handleCopySuccess(buttonElement, code) {
    const originalHTML = buttonElement.innerHTML;
    buttonElement.classList.add('copied');
    buttonElement.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
    showToast(`Promo code "${code}" copied to clipboard!`, 'success');

    setTimeout(() => {
      buttonElement.classList.remove('copied');
      buttonElement.innerHTML = originalHTML;
    }, 2500);
  }

  // =========================================================================
  // 9. Customer Testimonials Slider
  // =========================================================================
  function renderTestimonialSlider() {
    const track = document.getElementById('testimonialTrack');
    const dotsContainer = document.getElementById('sliderDots');
    const prevBtn = document.getElementById('prevTestimonialBtn');
    const nextBtn = document.getElementById('nextTestimonialBtn');

    if (!track || !dotsContainer) return;

    track.innerHTML = state.testimonials.map((t) => `
      <div class="testimonial-slide">
        <div class="testimonial-card-inner">
          <i class="fa-solid fa-quote-left testimonial-quote-icon"></i>
          <div class="testimonial-stars">
            ${Array(t.rating).fill('<i class="fa-solid fa-star"></i>').join('')}
          </div>
          <p class="testimonial-text">"${t.quote}"</p>
          <div class="testimonial-user-profile">
            <img src="${t.avatar}" alt="${t.name}" class="testimonial-avatar" loading="lazy">
            <div>
              <div class="user-name">${t.name}</div>
              <div class="user-role">${t.role} • <span style="color:var(--accent);">${t.location}</span></div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    dotsContainer.innerHTML = state.testimonials.map((_, idx) => `
      <span class="slider-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>
    `).join('');

    const dots = dotsContainer.querySelectorAll('.slider-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goToSlide(parseInt(dot.dataset.index, 10));
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        let prevIndex = state.currentSlide - 1;
        if (prevIndex < 0) prevIndex = state.testimonials.length - 1;
        goToSlide(prevIndex);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        let nextIndex = state.currentSlide + 1;
        if (nextIndex >= state.testimonials.length) nextIndex = 0;
        goToSlide(nextIndex);
      });
    }

    startAutoSlide();

    track.parentElement.addEventListener('mouseenter', stopAutoSlide);
    track.parentElement.addEventListener('mouseleave', startAutoSlide);
  }

  function goToSlide(index) {
    const track = document.getElementById('testimonialTrack');
    const dots = document.querySelectorAll('.slider-dot');
    if (!track) return;

    state.currentSlide = index;
    track.style.transform = `translateX(-${index * 100}%)`;

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === index);
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    state.slideInterval = setInterval(() => {
      let nextIndex = state.currentSlide + 1;
      if (nextIndex >= state.testimonials.length) nextIndex = 0;
      goToSlide(nextIndex);
    }, 6000);
  }

  function stopAutoSlide() {
    if (state.slideInterval) {
      clearInterval(state.slideInterval);
      state.slideInterval = null;
    }
  }

  // =========================================================================
  // 10. Newsletter Form Validation & Persistence
  // =========================================================================
  function initNewsletterForm() {
    const form = document.getElementById('newsletterForm');
    const emailInput = document.getElementById('newsletterEmail');
    const statusMsg = document.getElementById('newsletterStatus');

    if (!form || !emailInput || !statusMsg) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        statusMsg.textContent = 'Please provide a valid email address.';
        statusMsg.className = 'newsletter-status-msg error';
        return;
      }

      // Save subscriber and redirect to 404 page
      const subscribers = JSON.parse(localStorage.getItem('stackly_subscribers') || '[]');
      if (!subscribers.includes(email)) {
        subscribers.push(email);
        localStorage.setItem('stackly_subscribers', JSON.stringify(subscribers));
      }

      const queryParams = new URLSearchParams({
        dest: 'VIP Newsletter Membership',
        in: email,
        guests: '1 Subscriber'
      });
      emailInput.value = ''; // Reset input field so back button shows empty
      window.location.href = `404.html?${queryParams.toString()}`;
    });

    // Initialize Footer Newsletter Form
    const footerForm = document.getElementById('footerNewsletterForm');
    const footerEmail = document.getElementById('footerNewsletterEmail');
    const footerStatus = document.getElementById('footerNewsletterStatus');

    if (footerForm && footerEmail && footerStatus) {
      footerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = footerEmail.value.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          footerStatus.textContent = 'Please provide a valid email address.';
          footerStatus.className = 'footer-newsletter-feedback error';
          return;
        }

        // Save subscriber and redirect to 404 page
        const subscribers = JSON.parse(localStorage.getItem('stackly_subscribers') || '[]');
        if (!subscribers.includes(email)) {
          subscribers.push(email);
          localStorage.setItem('stackly_subscribers', JSON.stringify(subscribers));
        }

        const queryParams = new URLSearchParams({
          dest: 'Stackly Newsletter Portal',
          in: email,
          guests: '1 Subscriber'
        });
        footerEmail.value = ''; // Reset input field so back button shows empty
        window.location.href = `404.html?${queryParams.toString()}`;
      });
    }
  }

  // =========================================================================
  // 11. Toast Notifications Utility
  // =========================================================================
  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}" style="color: var(--accent); font-size:1.1rem;"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
});
