/**
 * Stock Dashboard - Real-time SSE Client Application
 * Handles WebSocket connections, UI updates, filtering, and data visualization
 */

class StockDashboard {
  constructor() {
    this.eventSource = null;
    this.stockElements = {};
    this.stockHistory = {};
    this.filters = {
      priceMin: 0,
      symbol: "",
      sector: "",
    };
    this.availableSymbols = new Set();
    this.availableSectors = new Set();
    this.alerts = [];
    this.maxAlerts = 5;

    this.initializeElements();
    this.setupEventListeners();
    this.connect();
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.stockQuotesDiv = document.getElementById("stock-quotes");
    this.alertsContainer = document.getElementById("alertsContainer");
    this.alertsCount = document.getElementById("alertsCount");
    this.connectionStatus = document.getElementById("connectionStatus");
    this.priceFilter = document.getElementById("priceFilter");
    this.symbolFilter = document.getElementById("symbolFilter");
    this.sectorFilter = document.getElementById("sectorFilter");
    this.marketSummary = document.getElementById("marketSummary");
  }

  /**
   * Setup event listeners for filters and controls
   */
  setupEventListeners() {
    this.priceFilter.addEventListener("input", () => {
      this.filters.priceMin = parseFloat(this.priceFilter.value) || 0;
      this.applyFilters();
    });

    this.symbolFilter.addEventListener("change", () => {
      this.filters.symbol = this.symbolFilter.value;
      this.applyFilters();
    });

    this.sectorFilter.addEventListener("change", () => {
      this.filters.sector = this.sectorFilter.value;
      this.applyFilters();
    });
  }

  /**
   * Establish SSE connection to server
   */
  connect() {
    this.eventSource = new EventSource("/stream");

    this.eventSource.onopen = () => {
      this.updateConnectionStatus(true);
    };

    this.eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      this.updateConnectionStatus(false);

      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.connect();
        }
      }, 5000);
    };

    // Register event handlers for different event types
    this.eventSource.addEventListener("stock_update", (event) => {
      this.handleStockUpdate(JSON.parse(event.data));
    });

    this.eventSource.addEventListener("market_alert", (event) => {
      this.handleMarketAlert(JSON.parse(event.data));
    });

    this.eventSource.addEventListener("market_summary", (event) => {
      this.handleMarketSummary(JSON.parse(event.data));
    });
  }

  /**
   * Update connection status indicator
   * @param {boolean} connected - Connection state
   */
  updateConnectionStatus(connected) {
    const indicator = this.connectionStatus.querySelector(".status-indicator");
    const text = this.connectionStatus.querySelector("span");

    if (connected) {
      this.connectionStatus.className = "connection-status connected";
      indicator.className = "status-indicator connected";
      text.textContent = "En ligne";
    } else {
      this.connectionStatus.className = "connection-status disconnected";
      indicator.className = "status-indicator disconnected";
      text.textContent = "Déconnecté";
    }
  }

  /**
   * Handle incoming stock price updates
   * @param {Object} data - Stock update data
   */
  handleStockUpdate(data) {
    const { symbol, price, change, change_percent, sector, volume } = data;

    // Update available options for filters
    this.availableSymbols.add(symbol);
    this.availableSectors.add(sector);
    this.updateFilterOptions();

    // Update stock history
    if (!this.stockHistory[symbol]) {
      this.stockHistory[symbol] = [];
    }
    this.stockHistory[symbol].push(price);
    if (this.stockHistory[symbol].length > 10) {
      this.stockHistory[symbol].shift();
    }

    // Create or update stock card
    let stockCard = this.stockElements[symbol];
    if (!stockCard) {
      stockCard = this.createStockCard(symbol);
      this.stockElements[symbol] = stockCard;
      this.stockQuotesDiv.appendChild(stockCard);

      // Remove "no stocks" message
      const noStocks = this.stockQuotesDiv.querySelector(".no-stocks");
      if (noStocks) noStocks.remove();
    }

    this.updateStockCard(stockCard, {
      symbol,
      price,
      change,
      change_percent,
      sector,
      volume,
    });
    this.applyFilters();

    // Add highlight animation
    stockCard.classList.add("updated");
    setTimeout(() => stockCard.classList.remove("updated"), 1000);
  }

  /**
   * Create a new stock card element
   * @param {string} symbol - Stock symbol
   * @returns {HTMLElement} Created stock card
   */
  createStockCard(symbol) {
    const card = document.createElement("div");
    card.className = "stock-card";
    card.id = `stock-${symbol}`;

    card.innerHTML = `
            <div class="stock-header">
                <div class="stock-symbol">${symbol}</div>
                <div class="stock-sector"></div>
            </div>
            <div class="stock-price"></div>
            <div class="stock-change">
                <div class="change-amount"></div>
                <div class="change-percent"></div>
            </div>
            <div class="stock-details">
                <div class="volume">Volume: <span></span></div>
                <div class="timestamp">Mis à jour: <span></span></div>
            </div>
            <div class="stock-history">
                <div class="history-label">Historique des prix</div>
                <div class="history-chart"></div>
                <div class="history-prices"></div>
            </div>
        `;

    return card;
  }

  /**
   * Update stock card with new data
   * @param {HTMLElement} card - Stock card element
   * @param {Object} data - Stock data
   */
  updateStockCard(card, data) {
    const { symbol, price, change, change_percent, sector, volume } = data;

    card.querySelector(".stock-sector").textContent = sector;
    card.querySelector(".stock-price").textContent = `${price} €`;

    const changeAmount = card.querySelector(".change-amount");
    const changePercent = card.querySelector(".change-percent");

    changeAmount.textContent = `${change > 0 ? "+" : ""}${change} €`;
    changePercent.textContent = `(${
      change_percent > 0 ? "+" : ""
    }${change_percent}%)`;

    // Update colors based on change
    const changeClass =
      change > 0 ? "price-up" : change < 0 ? "price-down" : "price-unchanged";
    changeAmount.className = `change-amount ${changeClass}`;
    changePercent.className = `change-percent ${changeClass}`;

    card.querySelector(".volume span").textContent = volume.toLocaleString();
    card.querySelector(".timestamp span").textContent =
      new Date().toLocaleTimeString();

    this.updateHistoryChart(card, symbol);
  }

  /**
   * Update price history chart for a stock
   * @param {HTMLElement} card - Stock card element
   * @param {string} symbol - Stock symbol
   */
  updateHistoryChart(card, symbol) {
    const history = this.stockHistory[symbol] || [];
    const chartContainer = card.querySelector(".history-chart");
    const pricesContainer = card.querySelector(".history-prices");

    // Clear previous chart
    chartContainer.innerHTML = "";

    if (history.length > 0) {
      const maxPrice = Math.max(...history);
      const minPrice = Math.min(...history);
      const range = maxPrice - minPrice || 1;

      history.forEach((price, index) => {
        const bar = document.createElement("div");
        bar.className = `history-bar ${
          index === history.length - 1 ? "latest" : ""
        }`;
        const height = ((price - minPrice) / range) * 25 + 5; // 5px minimum height
        bar.style.height = `${height}px`;
        bar.title = `${price} €`;
        chartContainer.appendChild(bar);
      });

      pricesContainer.textContent = history.map((p) => `${p}€`).join(" → ");
    }
  }

  /**
   * Handle market alert events
   * @param {Object} data - Alert data
   */
handleMarketAlert(data) {
  const alert = this.createAlert(data);
  this.alertsContainer.prepend(alert);
  this.alerts.unshift(alert);

  // Remove "no alerts" message if it exists
  const noAlerts = this.alertsContainer.querySelector(".no-alerts");
  if (noAlerts) noAlerts.remove();

  // Update alerts counter
  this.updateAlertsCounter();

  // Remove old alerts
  if (this.alerts.length > this.maxAlerts) {
    const oldAlert = this.alerts.pop();
    if (oldAlert && oldAlert.parentNode) {
      oldAlert.parentNode.removeChild(oldAlert);
    }
  }

  // Auto-remove after 15 seconds (increased for sidebar)
  setTimeout(() => {
    this.removeAlert(alert);
  }, 15000);
}

  /**
   * Create alert element
   * @param {Object} data - Alert data
   * @returns {HTMLElement} Alert element
   */
  createAlert(data) {
    const alert = document.createElement("div");
    alert.className = `alert ${data.level}`;

    alert.innerHTML = `
            <div class="alert-icon">${data.icon}</div>
            <div class="alert-content">
                <div>${data.message}</div>
                <div class="alert-time">${new Date().toLocaleTimeString()}</div>
            </div>
            <button class="alert-close" onclick="this.parentElement.remove()">×</button>
        `;

    return alert;
  }

  /**
   * Remove alert with animation
   * @param {HTMLElement} alert - Alert element to remove
   */
  removeAlert(alert) {
    if (alert && alert.parentNode) {
      alert.style.animation = "slideInRight 0.3s ease-out reverse";
      setTimeout(() => {
        if (alert.parentNode) {
          alert.parentNode.removeChild(alert);
        }
        this.alerts = this.alerts.filter((a) => a !== alert);
        this.updateAlertsCounter();

        // Show "no alerts" message if no alerts remain
        if (this.alerts.length === 0) {
          this.showNoAlertsMessage();
        }
      }, 300);
    }
  }

  /**
   * Update the alerts counter display
   */
  updateAlertsCounter() {
    if (this.alertsCount) {
      this.alertsCount.textContent = this.alerts.length;
    }
  }

  /**
   * Show "no alerts" message when there are no alerts
   */
  showNoAlertsMessage() {
    if (!this.alertsContainer.querySelector(".no-alerts")) {
      const noAlerts = document.createElement("div");
      noAlerts.className = "no-alerts";
      noAlerts.textContent = "Aucune alerte pour le moment";
      this.alertsContainer.appendChild(noAlerts);
    }
  }

  /**
   * Handle market summary updates
   * @param {Object} data - Market summary data
   */
  handleMarketSummary(data) {
    this.marketSummary.style.display = "flex";

    const trendElement = document.getElementById("marketTrend");
    trendElement.textContent =
      data.market_trend === "up" ? "📈 Haussier" : "📉 Baissier";
    trendElement.className = `value ${
      data.market_trend === "up" ? "price-up" : "price-down"
    }`;

    document.getElementById("activeStocks").textContent = data.active_stocks;

    const avgChangeElement = document.getElementById("avgChange");
    avgChangeElement.textContent = `${data.avg_change > 0 ? "+" : ""}${
      data.avg_change
    }€`;
    avgChangeElement.className = `value ${
      data.avg_change > 0
        ? "price-up"
        : data.avg_change < 0
        ? "price-down"
        : "price-unchanged"
    }`;
  }

  /**
   * Update filter dropdown options
   */
  updateFilterOptions() {
    // Update symbol filter
    const currentSymbol = this.symbolFilter.value;
    this.symbolFilter.innerHTML = '<option value="">Tous les symboles</option>';
    Array.from(this.availableSymbols)
      .sort()
      .forEach((symbol) => {
        const option = document.createElement("option");
        option.value = symbol;
        option.textContent = symbol;
        if (symbol === currentSymbol) option.selected = true;
        this.symbolFilter.appendChild(option);
      });

    // Update sector filter
    const currentSector = this.sectorFilter.value;
    this.sectorFilter.innerHTML = '<option value="">Tous les secteurs</option>';
    Array.from(this.availableSectors)
      .sort()
      .forEach((sector) => {
        const option = document.createElement("option");
        option.value = sector;
        option.textContent = sector;
        if (sector === currentSector) option.selected = true;
        this.sectorFilter.appendChild(option);
      });
  }

  /**
   * Apply current filters to stock cards
   */
  applyFilters() {
    Object.values(this.stockElements).forEach((card) => {
      const symbol = card.id.replace("stock-", "");
      const priceText = card.querySelector(".stock-price").textContent;
      const price = parseFloat(priceText.replace(" €", ""));
      const sector = card.querySelector(".stock-sector").textContent;

      let shouldShow = true;

      // Price filter
      if (price < this.filters.priceMin) {
        shouldShow = false;
      }

      // Symbol filter
      if (this.filters.symbol && symbol !== this.filters.symbol) {
        shouldShow = false;
      }

      // Sector filter
      if (this.filters.sector && sector !== this.filters.sector) {
        shouldShow = false;
      }

      card.style.display = shouldShow ? "block" : "none";
    });

    // Show/hide "no stocks" message
    const visibleCards = Object.values(this.stockElements).filter(
      (card) => card.style.display !== "none"
    ).length;

    if (visibleCards === 0 && Object.keys(this.stockElements).length > 0) {
      if (!this.stockQuotesDiv.querySelector(".no-stocks")) {
        const noStocks = document.createElement("div");
        noStocks.className = "no-stocks";
        noStocks.textContent =
          "Aucune action ne correspond aux filtres appliqués";
        this.stockQuotesDiv.appendChild(noStocks);
      }
    } else {
      const noStocks = this.stockQuotesDiv.querySelector(".no-stocks");
      if (noStocks) noStocks.remove();
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.updateConnectionStatus(false);
    }
  }
}

// Application initialization and lifecycle management
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new StockDashboard();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.disconnect();
    }
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Tab hidden - continuing updates');
    } else {
        console.log('Tab visible - ensuring connection');
        if (dashboard && dashboard.eventSource.readyState === EventSource.CLOSED) {
            dashboard.connect();
        }
    }
});