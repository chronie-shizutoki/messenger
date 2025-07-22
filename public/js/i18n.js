class I18n {
  constructor() {
    const userLanguage = navigator.language || 'en-US';
    this.supportedLanguages = ['en-US', 'zh-CN', 'ja-JP']; // 支持的语言列表
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

    // 为每种支持的语言创建选项
    this.supportedLanguages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang.toUpperCase();
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
    dropdown.style.zIndex = '1000';
    dropdown.style.padding = '12px 20px';
    dropdown.style.border = '2px solid #4285f4';
    dropdown.style.borderRadius = '50px';
    dropdown.style.backgroundColor = 'transparent';
    dropdown.style.color = 'rgb(255, 255, 255)';
    dropdown.style.fontSize = '15px';
    dropdown.style.fontWeight = '100';
    dropdown.style.cursor = 'pointer';
    dropdown.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    dropdown.style.transition = 'all 0.3s ease';
    dropdown.style.outline = 'none';
    dropdown.style.textAlign = 'center';

    document.body.prepend(dropdown);
  }
  applyTranslations() {
        // 支持嵌套键的翻译文本替换
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const keys = key.split('.');
            let value = this.translations;
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    value = key;
                    break;
                }
            }
            element.textContent = value;
        });

    // 翻译占位符
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.translations[key] || key;
    });
  }

  // 设置页面语言
  setDocumentLanguage() {
    document.documentElement.lang = this.locale;
  }
}
// 在DOM加载完成后初始化国际化
// 立即初始化i18n实例
window.i18n = I18n.getInstance();