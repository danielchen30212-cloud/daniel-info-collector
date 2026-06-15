// server.js - Express後端服務
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');

dotenv.config();
const app = express();

// 中間件
app.use(cors());
app.use(express.json());

// MongoDB連接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/info-collector', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// ===== 數據模型 =====
const articleSchema = new mongoose.Schema({
  title: String,
  source: String,
  sourceId: String,
  date: Date,
  url: String,
  excerpt: String,
  content: String,
  keywords: [String],
  country: String,
  category: String,
  saved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

articleSchema.index({ source: 1, date: -1 });
articleSchema.index({ keywords: 1 });
articleSchema.index({ createdAt: -1 });

const Article = mongoose.model('Article', articleSchema);

// 設置模型
const settingsSchema = new mongoose.Schema({
  key: String,
  value: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now }
});

const Settings = mongoose.model('Settings', settingsSchema);

// ===== 爬蟲配置 =====
const sources = {
  kpmg: {
    name: 'KPMG',
    url: 'https://kpmg.com/insights',
    method: 'rss'
  },
  pwc: {
    name: 'PwC',
    url: 'https://www.pwc.com/gx/en/news.html',
    method: 'scrape'
  },
  ey: {
    name: 'EY',
    url: 'https://www.ey.com/en/gl/issues',
    method: 'scrape'
  },
  deloitte: {
    name: 'Deloitte',
    url: 'https://www2.deloitte.com/insights/us/en.html',
    method: 'scrape'
  },
  bbc: {
    name: 'BBC',
    url: 'https://www.bbc.com/news',
    method: 'rss'
  },
  cnn: {
    name: 'CNN',
    url: 'https://www.cnn.com',
    method: 'scrape'
  },
  cgtn: {
    name: 'CGTN',
    url: 'https://news.cgtn.com',
    method: 'scrape'
  },
  business: {
    name: 'Business Insider',
    url: 'https://www.businessinsider.com/tech',
    method: 'scrape'
  },
  times: {
    name: 'Times',
    url: 'https://www.thetimes.com/news',
    method: 'scrape'
  },
  bloomberg: {
    name: 'Bloomberg',
    url: 'https://www.bloomberg.com/technology',
    method: 'scrape'
  }
};

// 關鍵詞列表
const KEYWORDS_TO_MONITOR = [
  'Taiwan',
  'China',
  'Technology',
  'AI',
  'Artificial Intelligence',
  'Supply Chain',
  'Supply',
  '台灣',
  '中國',
  '科技',
  '人工智能',
  '供應鏈'
];

const COUNTRIES = ['Taiwan', 'China', 'US', 'USA', '台灣', '中國', '美國'];

// ===== 爬蟲函數 =====
class Scraper {
  static async fetchArticles(sourceId, sourceConfig) {
    try {
      const response = await axios.get(sourceConfig.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      const articles = [];
      const $ = cheerio.load(response.data);

      // 根據來源選擇合適的選擇器
      const selectors = this.getSelectors(sourceId);

      $(selectors.article).each((idx, el) => {
        try {
          const title = $(el).find(selectors.title).text().trim();
          const excerpt = $(el).find(selectors.excerpt).text().trim();
          const url = $(el).find(selectors.link).attr('href');
          const dateStr = $(el).find(selectors.date).text().trim();

          if (title && url) {
            const keywords = this.extractKeywords(title + ' ' + excerpt);
            const country = this.detectCountry(title + ' ' + excerpt);

            articles.push({
              title,
              excerpt: excerpt.substring(0, 200),
              url: this.normalizeUrl(url, sourceConfig.url),
              source: sourceConfig.name,
              sourceId,
              date: this.parseDate(dateStr),
              keywords,
              country
            });
          }
        } catch (err) {
          console.error(`Error parsing article from ${sourceId}:`, err.message);
        }
      });

      return articles;
    } catch (err) {
      console.error(`Scraping error for ${sourceId}:`, err.message);
      return [];
    }
  }

  static getSelectors(sourceId) {
    const selectorMap = {
      kpmg: {
        article: 'article.insight-card',
        title: 'h3',
        excerpt: '.insight-summary',
        link: 'a',
        date: '.publish-date'
      },
      pwc: {
        article: '.insight-item',
        title: '.insight-title',
        excerpt: '.insight-excerpt',
        link: 'a',
        date: '.date'
      },
      bbc: {
        article: 'article',
        title: 'h2, h3',
        excerpt: 'p',
        link: 'a',
        date: 'time'
      },
      cnn: {
        article: '.card',
        title: 'span.headline__text',
        excerpt: 'span.headline__description',
        link: 'a',
        date: 'span.container__headline-date'
      },
      default: {
        article: 'article, .article, .news-item',
        title: 'h1, h2, h3, .title',
        excerpt: 'p, .excerpt, .summary',
        link: 'a',
        date: '.date, time, .published'
      }
    };

    return selectorMap[sourceId] || selectorMap.default;
  }

  static extractKeywords(text) {
    const found = [];
    KEYWORDS_TO_MONITOR.forEach(keyword => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        found.push(keyword);
      }
    });
    return [...new Set(found)]; // 去重
  }

  static detectCountry(text) {
    for (const country of COUNTRIES) {
      if (text.toLowerCase().includes(country.toLowerCase())) {
        return country;
      }
    }
    return 'Other';
  }

  static parseDate(dateStr) {
    // 簡單的日期解析邏輯
    if (!dateStr) return new Date();
    
    const now = new Date();
    if (dateStr.includes('hour') || dateStr.includes('小時')) {
      const hours = parseInt(dateStr) || 1;
      return new Date(now - hours * 60 * 60 * 1000);
    }
    if (dateStr.includes('day') || dateStr.includes('天')) {
      const days = parseInt(dateStr) || 1;
      return new Date(now - days * 24 * 60 * 60 * 1000);
    }
    
    try {
      return new Date(dateStr);
    } catch {
      return now;
    }
  }

  static normalizeUrl(url, baseUrl) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return new URL(baseUrl).origin + url;
    return new URL(baseUrl).origin + '/' + url;
  }
}

// ===== API 路由 =====

// 獲取文章列表
app.get('/api/articles', async (req, res) => {
  try {
    const { sources, keywords, dateRange = 'week', page = 1, limit = 20 } = req.query;

    let query = {};

    // 篩選來源
    if (sources && sources.length > 0) {
      const sourceList = Array.isArray(sources) ? sources : [sources];
      query.sourceId = { $in: sourceList };
    }

    // 篩選關鍵詞
    if (keywords && keywords.length > 0) {
      const keywordList = Array.isArray(keywords) ? keywords : [keywords];
      query.keywords = { $in: keywordList };
    }

    // 篩選日期範圍
    const now = new Date();
    let dateFilter = {};
    switch (dateRange) {
      case 'day':
        dateFilter = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
        break;
      case 'week':
        dateFilter = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        break;
      case 'month':
        dateFilter = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        break;
    }
    if (Object.keys(dateFilter).length > 0) {
      query.date = dateFilter;
    }

    // 分頁
    const skip = (page - 1) * limit;

    const articles = await Article.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Article.countDocuments(query);

    res.json({
      articles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 獲取單篇文章
app.get('/api/articles/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存文章
app.post('/api/articles/:id/save', async (req, res) => {
  try {
    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { saved: true },
      { new: true }
    );
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 獲取統計信息
app.get('/api/stats', async (req, res) => {
  try {
    const total = await Article.countDocuments();
    const sources = await Article.distinct('sourceId');
    const keywords = await Article.distinct('keywords');
    const lastUpdate = await Article.findOne().sort({ createdAt: -1 });

    res.json({
      totalArticles: total,
      sources: sources.length,
      keywords: keywords.length,
      lastUpdate: lastUpdate?.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 手動觸發更新
app.post('/api/update', async (req, res) => {
  try {
    await updateAllSources();
    res.json({ message: 'Update started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ===== 定時更新任務 =====

async function updateAllSources() {
  console.log('[Cron] Starting update cycle at', new Date().toISOString());
  
  for (const [sourceId, config] of Object.entries(sources)) {
    try {
      console.log(`[Cron] Fetching from ${sourceId}...`);
      const articles = await Scraper.fetchArticles(sourceId, config);
      
      // 只保存包含目標關鍵詞的文章
      const filtered = articles.filter(
        a => a.keywords.length > 0 || 
             KEYWORDS_TO_MONITOR.some(k => a.title.includes(k))
      );

      // 批量插入（避免重複）
      for (const article of filtered) {
        await Article.updateOne(
          { url: article.url },
          { $set: article },
          { upsert: true }
        );
      }

      console.log(`[Cron] ${filtered.length} articles saved from ${sourceId}`);
    } catch (err) {
      console.error(`[Cron] Error updating ${sourceId}:`, err.message);
    }
  }

  console.log('[Cron] Update cycle completed at', new Date().toISOString());
}

// 每週一 08:00 執行
// cron.schedule('0 8 * * 1', updateAllSources);

// 為了測試，每小時執行一次
cron.schedule('0 * * * *', updateAllSources);

// 啟動時執行一次
if (process.env.NODE_ENV !== 'testing') {
  // updateAllSources();
}

// ===== 伺服器啟動 =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Cron job scheduled: Updates every hour');
});

module.exports = app;
