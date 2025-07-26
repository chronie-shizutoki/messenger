class I18n {
  constructor() {
    const userLanguage = navigator.language || 'en-US';
    this.supportedLanguages = ['en-GB', 'en-US', 'es-ES', 'fr-FR', 'ja-JP', 'ko-KR', 'ms-MY', 'zh-CN', 'zh-HK', 'zh-TW']; // 支持的语言列表
    this.locale = this.getBestMatchingLanguage(userLanguage);
    this.translations = {};
    this.init();
  }

  static getInstance() {
    if (!window.i18n) {
      window.i18n = new I18n();
    }
    return window.i18n;
  }

  getBestMatchingLanguage(userLanguage) {
    const langCode = userLanguage.split('-')[0];
    // 首先尝试完全匹配
    if (this.supportedLanguages.includes(userLanguage)) {
      return userLanguage;
    }
    // 然后尝试匹配主要语言代码
    for (const lang of this.supportedLanguages) {
      const langPrimaryCode = lang.split('-')[0];
      if (langPrimaryCode === langCode) {
        return lang;
      }
    }
    // 默认返回英语
    return 'en-US';
  }

  async init() {
    // 加载语言文件
    await this.loadTranslations();
    // 创建语言下拉菜单
    this.createLanguageDropdown();
    // 应用翻译
    this.applyTranslations();
    // 修改页面语言
    this.setDocumentLanguage();
    // 触发初始化完成事件
    const event = new Event('i18nInitialized');
    document.dispatchEvent(event);
  }

  async loadTranslations() {
    try {
      const response = await fetch(`/locales/${this.locale}.json`);
      if (!response.ok) throw new Error(`Failed to load translations for ${this.locale}`);
      this.translations = await response.json();
    } catch (error) {
      console.error('Error loading translations:', error);
      // 加载失败时回退
      const response = await fetch('/locales/en-US.json');
      this.translations = await response.json();
      this.locale = 'en-US';
    }
    // 加载翻译后修改页面语言
    this.setDocumentLanguage();
  }

  createLanguageDropdown() {
    // 创建下拉菜单元素
    const dropdown = document.createElement('select');
    dropdown.className = 'language-selector';

    // 语言代码到显示名称的映射
    const languageNames = {
      'en-GB': 'English (UK)',
      'en-US': 'English (US)',
      'es-ES': 'Español (España)',
      'fr-FR': 'Français (France)',
      'ja-JP': '日本語 (日本)',
      'ko-KR': '한국어 (대한민국)',
      'ms-MY': 'Bahasa Melayu (Malaysia)',
      'zh-CN': '简体中文（中国大陆）',
      'zh-HK': '繁體中文（香港）',
      'zh-TW': '正體中文（台灣）'
    };

    // 为每种支持的语言创建选项
    this.supportedLanguages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = languageNames[lang] || lang.toUpperCase();
      option.selected = lang === this.locale;
      dropdown.appendChild(option);
    });

    // 添加语言切换事件监听
    dropdown.addEventListener('change', async (e) => {
      this.locale = e.target.value;
      await this.loadTranslations();
      this.applyTranslations();
      // 触发语言变更事件
      const event = new Event('i18nLanguageChanged');
      event.detail = { locale: this.locale };
      document.dispatchEvent(event);
    });

    // 美化并将下拉菜单添加到页面
    dropdown.style.position = 'absolute';
    dropdown.style.top = '20%';
    dropdown.style.left = '50%';
    dropdown.style.transform = 'translateX(-50%)';
    dropdown.style.padding = '12px 24px';
    dropdown.style.border = '2px solid #4f46e5';
    dropdown.style.borderRadius = '12px';
    dropdown.style.backgroundColor = 'rgba(30, 41, 59, 0.95)';
    dropdown.style.color = 'rgba(255, 255, 255, 0.9)';
    dropdown.style.fontSize = '16px';
    dropdown.style.fontWeight = '500';
    dropdown.style.cursor = 'pointer';
    dropdown.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    dropdown.style.transition = 'all 0.2s ease-in-out';
    dropdown.style.outline = 'none';
    dropdown.style.textAlign = 'left';
    dropdown.style.minWidth = '180px';

    if (window.matchMedia('(min-width: 768px)').matches) {
      dropdown.style.left = ''; // Reset left value to default
      dropdown.style.right = '5%'; // Simplify the calculation
      dropdown.style.top = '10%';
    }

    // 添加悬停效果
    dropdown.addEventListener('mouseenter', () => {
      dropdown.style.borderColor = '#2563eb';
      dropdown.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.18)';
    });

    dropdown.addEventListener('mouseleave', () => {
      dropdown.style.borderColor = '#3b82f6';
      dropdown.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    document.body.prepend(dropdown);
  }
  applyTranslations() {
        // Support translation text replacement
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translations[key] || key;
        });

    // 翻译占位符
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.translations[key] || key;
    });

    // 翻译title属性
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.translations[key] || key;
    });
  }
  // 支持i18n.t('chat.quote_from', {safeTimestamp})
  t(key, params) {
    let text = this.translations[key] || key;
    if (params) {
      Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
      });
    }
    return text;
  }
  // 支持data-i18n-args="${safeTimestamp}"
 

  // 设置页面语言
  setDocumentLanguage() {
    document.documentElement.lang = this.locale;
  }
}
// 在DOM加载完成后初始化国际化
// 立即初始化i18n实例
window.i18n = I18n.getInstance();