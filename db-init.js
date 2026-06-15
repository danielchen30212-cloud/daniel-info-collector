const mongoose = require('mongoose');
require('dotenv').config();

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

const Article = mongoose.model('Article', articleSchema);

async function initDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/info-collector';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // 創建索引
    await Article.collection.createIndex({ source: 1, date: -1 });
    await Article.collection.createIndex({ keywords: 1 });
    await Article.collection.createIndex({ createdAt: -1 });
    
    console.log('Indexes created successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

const command = process.argv[2];

if (command === 'init') {
  initDatabase();
} else {
  console.log('Usage: node db-init.js init');
  process.exit(0);
}
