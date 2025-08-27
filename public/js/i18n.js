class I18n {
  constructor() {
    // 首先尝试从localStorage读取保存的语言
    const savedLanguage = localStorage.getItem('preferredLanguage');
    const userLanguage = savedLanguage || navigator.language || 'en-US';
    this.supportedLanguages = ['en-GB', 'en-US', 'es-ES', 'fr-FR', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW']; // 支持的语言列表
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
      // 先加载en-US作为基础回退语言
      const enUSResponse = await fetch('/locales/en-US.json');
      const enUSTranslations = await enUSResponse.json();
      
      // 然后加载用户选择的语言
      if (this.locale !== 'en-US') {
        const response = await fetch(`/locales/${this.locale}.json`);
        if (response.ok) {
          const userTranslations = await response.json();
          // 合并翻译，用户语言有翻译的使用用户语言，没有的使用en-US
          this.translations = { ...enUSTranslations, ...userTranslations };
        } else {
          console.warn(`Failed to load translations for ${this.locale}, using en-US instead`);
          this.translations = enUSTranslations;
          this.locale = 'en-US';
        }
      } else {
        this.translations = enUSTranslations;
      }
    } catch (error) {
      console.error('Error loading translations:', error);
      // 加载失败时回退到en-US
      const response = await fetch('/locales/en-US.json');
      this.translations = await response.json();
      this.locale = 'en-US';
    }
    // 加载翻译后修改页面语言
    this.setDocumentLanguage();
  }

  createLanguageDropdown() {
    // 语言代码到显示名称的映射
    const languageNames = {
      'en-GB': 'English (UK)',
      'en-US': 'English (US)',
      'es-ES': 'Español (España)',
      'fr-FR': 'Français (France)',
      'ja-JP': '日本語 (日本)',
      'ko-KR': '한국어 (대한민국)',
      'zh-CN': '简体中文（中国大陆）',
      'zh-TW': '繁體中文（台灣）'
    };

    // 创建语言选择器容器
    const container = document.createElement('div');
    container.className = 'language-selector-container';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '40px';
    container.style.zIndex = '1000';

    // 创建图标按钮
    const button = document.createElement('button');
    button.className = 'language-button';
    button.innerHTML = '<i class="fa fa-globe"></i>';
    button.style.width = '40px';
    button.style.height = '40px';
    button.style.borderRadius = '50%';
    button.style.backgroundColor = 'transparent';
    button.style.color = 'rgba(0, 0, 0, 0.9)';
    button.style.border = '2px solid transparent';
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    button.style.cursor = 'pointer';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.fontSize = '20px';
    button.style.transition = 'all 0.2s ease-in-out';
    button.style.outline = 'none';

    // 添加悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.borderColor = 'transparent';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.18)';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.borderColor = '#4f46e5';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      button.style.transform = 'scale(1)';
    });

    // 创建语言列表
    const languageList = document.createElement('ul');
    languageList.className = 'language-list';
    languageList.style.position = 'absolute';
    languageList.style.bottom = '60px';
    languageList.style.right = '0';
    languageList.style.width = '200px';
languageList.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
languageList.style.backdropFilter = 'blur(10px)';
languageList.style.webkitBackdropFilter = 'blur(10px)';
languageList.style.borderColor = 'rgba(255, 255, 255, 0.18)';
    languageList.style.border = '2px solid transparent';
    languageList.style.borderRadius = '12px';
    languageList.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    languageList.style.padding = '10px 0';
    languageList.style.margin = '0';
    languageList.style.listStyle = 'none';
    languageList.style.display = 'none';
    languageList.style.maxHeight = '300px';
    languageList.style.overflowY = 'auto';

    // 为每种支持的语言创建列表项
    this.supportedLanguages.forEach(lang => {
      const li = document.createElement('li');
      li.textContent = languageNames[lang] || lang.toUpperCase();
      li.style.padding = '10px 15px';
      li.style.color = 'rgba(0, 0, 0, 0.9)';
      li.style.cursor = 'pointer';
      li.style.transition = 'background-color 0.2s ease-in-out';
      li.setAttribute('data-lang', lang);

      if (lang === this.locale) {
        li.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
        li.style.fontWeight = 'bold';
      }

      li.addEventListener('mouseenter', () => {
        li.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
      });

      li.addEventListener('mouseleave', () => {
        if (lang !== this.locale) {
          li.style.backgroundColor = 'transparent';
        }
      });

      li.addEventListener('click', async () => {
        this.locale = lang;
        // 保存语言选择到localStorage
        localStorage.setItem('preferredLanguage', lang);
        await this.loadTranslations();
        this.applyTranslations();
        // 更新选中项样式
        languageList.querySelectorAll('li').forEach(item => {
          if (item.getAttribute('data-lang') === lang) {
            item.style.backgroundColor = 'rgba(79, 70, 229, 0.2)';
            item.style.fontWeight = 'bold';
          } else {
            item.style.backgroundColor = 'transparent';
            item.style.fontWeight = 'normal';
          }
        });
        // 触发语言变更事件
        const event = new Event('i18nLanguageChanged');
        event.detail = { locale: this.locale };
        document.dispatchEvent(event);
        // 关闭列表
        languageList.style.display = 'none';
      });

      languageList.appendChild(li);
    });

    // 点击按钮切换列表显示/隐藏
    button.addEventListener('click', () => {
      languageList.style.display = languageList.style.display === 'none' ? 'block' : 'none';
    });

    // 点击页面其他地方关闭列表
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        languageList.style.display = 'none';
      }
    });

    // 将按钮和列表添加到容器
    container.appendChild(button);
    container.appendChild(languageList);

    // 将容器添加到页面
    document.body.appendChild(container);
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
  
  // 设置页面语言
  setDocumentLanguage() {
    document.documentElement.lang = this.locale;
  }
}
// 在DOM加载完成后初始化国际化
// 立即初始化i18n实例
window.i18n = I18n.getInstance();