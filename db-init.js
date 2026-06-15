import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

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

// 根據命令行參數執行不同操作
const command = process.argv[2];

switch(command) {
  case 'init':
    initDatabase();
    break;
  case 'clean':
    cleanDatabase();
    break;
  case 'clean-old':
    cleanOldArticles();
    break;
  default:
    console.log('Usage: node db-init.js [init|clean|clean-old]');
    process.exit(0);
}

async function cleanDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/info-collector';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await Article.deleteMany({});
    console.log('Database cleaned');
    
    process.exit(0);
  } catch (error) {
    console.error('Clean failed:', error);
    process.exit(1);
  }
}

async function cleanOldArticles() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/info-collector';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Article.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
    
    console.log(`Deleted ${result.deletedCount} old articles`);
    
    process.exit(0);
  } catch (error) {
    console.error('Clean old articles failed:', error);
    process.exit(1);
  }
}
