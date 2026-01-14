#!/usr/bin/env bun

/**
 * Test script for OpenAI blog generation
 * Tests the configurable AI service with OpenAI provider
 */

const aiService = require('./src/services/ai-service');
const logger = require('./src/utils/logger');

async function testOpenAIBlogGeneration() {
  console.log('\n🧪 Testing OpenAI Blog Generation\n');
  console.log('Configuration:');
  console.log(`- BLOG_AI_PROVIDER: ${process.env.BLOG_AI_PROVIDER || 'openai'}`);
  console.log(`- BLOG_AI_MODEL: ${process.env.BLOG_AI_MODEL || 'gpt-4o-mini'}`);
  console.log(`- OpenAI Key Set: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`- Gemini Key Set: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`- DeepSeek Key Set: ${!!process.env.DEEPSEEK_API_KEY}`);
  console.log('\n---\n');

  try {
    const topic = 'The need for investing from a young age';
    const category = 'blog';
    const blogType = 'beginner';

    console.log(`📝 Generating blog post...`);
    console.log(`   Topic: ${topic}`);
    console.log(`   Category: ${category}`);
    console.log(`   Type: ${blogType}\n`);

    const startTime = Date.now();
    
    const result = await aiService.generateBlogPost(topic, category, blogType);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ Blog post generated successfully!\n');
    console.log(`⏱️  Generation time: ${duration}s\n`);
    console.log('📄 Generated Content:\n');
    console.log('─'.repeat(80));
    console.log(`Title: ${result.title}`);
    console.log(`Meta Title: ${result.meta_title}`);
    console.log(`Meta Description: ${result.meta_description}`);
    console.log(`\nExcerpt:\n${result.excerpt}`);
    console.log(`\nTags: ${result.tags.join(', ')}`);
    console.log(`\nContent Preview (first 500 chars):\n${result.content.substring(0, 500)}...`);
    console.log('─'.repeat(80));
    console.log('\n✨ Test completed successfully!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed!\n');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
    console.error('\n');
    process.exit(1);
  }
}

// Run the test
testOpenAIBlogGeneration();
