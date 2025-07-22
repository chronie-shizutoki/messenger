// 定义创建时钟的函数
function createClock(language = 'en-US') {
    // 创建一个 div 元素作为时钟的容器
    const container = document.createElement('div');
    // 设置容器的类名为 'clock-container'
    container.className = 'clock-container';
    // 设置容器的 HTML 内容，包含发光效果、粒子效果、时钟表盘、时间显示和日期显示的元素
    container.innerHTML = `
        <div class="glow"></div>
        <div class="particles"></div>
            <div class="time-display" id="clockTime"></div>
            <div class="date-display" id="clockDate"></div>
    `;

    // 更新时间显示
    // 定义更新时间显示的函数
    function updateTime() {
        // 获取当前时间
        const now = new Date();
        // 获取容器中 id 为 'clockTime' 的元素
        const timeEl = container.querySelector('#clockTime');
        // 获取容器中 id 为 'clockDate' 的元素
        const dateEl = container.querySelector('#clockDate');
        
        // 格式化时间和日期 - 支持国际化
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    
    timeEl.textContent = new Intl.DateTimeFormat(language, timeOptions).format(now);
    dateEl.textContent = new Intl.DateTimeFormat(language, dateOptions).format(now);
    }

    // 调用更新时间显示的函数
    updateTime();
    // 每秒调用一次更新时间显示的函数，实现时间的实时更新
    setInterval(updateTime, 1000);
    // 返回创建好的时钟容器
    return container;
}

// 当DOM加载完成后初始化时钟
// 监听 DOM 内容加载完成事件
document.addEventListener('DOMContentLoaded', () => {
    // 创建一个 div 元素作为时钟的外层容器
    const clockContainer = document.createElement('div');
    // 设置外层容器的文本居中
    clockContainer.style.textAlign = 'center';
    // 将创建好的时钟添加到外层容器中
    let currentClockElement = null;

    // 更新时钟语言的函数
    function updateClockLanguage(locale) {
      // 移除旧时钟
      if (currentClockElement) {
        clockContainer.removeChild(currentClockElement);
      }
      // 创建新时钟
      currentClockElement = createClock(locale);
      clockContainer.appendChild(currentClockElement);
    }

    // 等待i18n初始化完成后再设置时钟语言
    document.addEventListener('i18nInitialized', () => {
      // 检查 i18n 是否存在，避免引用错误
      const userLanguage = typeof i18n !== 'undefined' ? (i18n.locale || navigator.language || 'en-US') : navigator.language || 'en-US';
      updateClockLanguage(userLanguage);
    });

    // 监听语言变化事件
    document.addEventListener('i18nLanguageChanged', (e) => {
      updateClockLanguage(e.detail.locale);
    });

    // 初始加载时如果i18n已经初始化完成
    if (typeof i18n !== 'undefined' && i18n.locale) {
      updateClockLanguage(i18n.locale);
    }
    // 将外层容器插入到 body 元素的第一个子元素之前
    document.body.insertBefore(clockContainer, document.body.firstChild);
});