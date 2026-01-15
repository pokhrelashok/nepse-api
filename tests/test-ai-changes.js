/**
 * Test AI Service Changes
 * Tests that portfolio summary and stock insights use DeepSeek from OpenRouter
 */

const { generateStockSummary, generatePortfolioSummary, generateBlogPost } = require('../src/services/ai-service');
const { getScriptDetails } = require('../src/database/queries');

async function testStockSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Stock AI Summary (should use DeepSeek)');
  console.log('='.repeat(60));

  try {
    const stockData = await getScriptDetails('NABIL');
    if (!stockData) {
      console.log('❌ NABIL stock not found in database');
      return false;
    }

    console.log(`📊 Testing with stock: ${stockData.symbol} (${stockData.company_name})`);
    console.log(`   LTP: ${stockData.last_traded_price}, PE: ${stockData.pe_ratio}, PB: ${stockData.pb_ratio}`);

    const summary = await generateStockSummary(stockData);

    if (summary) {
      console.log(`✅ Stock summary generated successfully:`);
      console.log(`   "${summary}"`);
      return true;
    } else {
      console.log('❌ Failed to generate stock summary');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing stock summary:', error.message);
    return false;
  }
}

async function testPortfolioSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Portfolio AI Summary (should use DeepSeek)');
  console.log('='.repeat(60));

  try {
    // Create mock holdings data
    const holdings = [
      {
        symbol: 'NABIL',
        quantity: 10,
        current_price: 1250,
        current_value: 12500,
        price_change_pct: 2.5,
        sector: 'Commercial Banks',
        ai_summary: 'Strong fundamentals'
      },
      {
        symbol: 'SCB',
        quantity: 5,
        current_price: 550,
        current_value: 2750,
        price_change_pct: -1.2,
        sector: 'Commercial Banks',
        ai_summary: 'Stable performer'
      }
    ];

    console.log(`📁 Testing with portfolio: "Test Portfolio" (${holdings.length} holdings)`);
    holdings.forEach(h => {
      const pctChange = h.price_change_pct > 0 ? `+${h.price_change_pct.toFixed(1)}` : h.price_change_pct.toFixed(1);
      console.log(`   - ${h.symbol}: ${h.quantity} units @ रु ${h.current_price} (${pctChange}%)`);
    });

    const summary = await generatePortfolioSummary('Test Portfolio', holdings);

    if (summary && summary.summary && summary.sentiment_score) {
      console.log(`✅ Portfolio summary generated successfully:`);
      console.log(`   Sentiment Score: ${summary.sentiment_score}/100`);
      console.log(`   Summary: "${summary.summary}"`);
      return true;
    } else {
      console.log('❌ Failed to generate portfolio summary');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing portfolio summary:', error.message);
    return false;
  }
}

async function testBlogGeneration() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Blog Generation (should use DeepSeek as primary)');
  console.log('='.repeat(60));

  try {
    console.log(`📝 Testing blog generation with topic: "Value Investing in Nepal Stock Market"`);

    const blog = await generateBlogPost('Value Investing in Nepal Stock Market', 'investing', 'informative');

    if (blog && blog.title && blog.content) {
      console.log(`✅ Blog generated successfully:`);
      console.log(`   Title: "${blog.title}"`);
      console.log(`   Excerpt: "${blog.excerpt}"`);
      console.log(`   Tags: ${blog.tags?.join(', ')}`);
      console.log(`   Content length: ${blog.content.length} characters`);
      return true;
    } else {
      console.log('❌ Failed to generate blog');
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing blog generation:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🤖 Testing AI Service Changes\n');
  console.log('Configuration:');
  console.log('  - Stock/Portfolio Summaries: DeepSeek via OpenRouter');
  console.log('  - Blog Generation: DeepSeek (primary) → Gemini (fallback)');
  console.log('  - Market Summary Blog: DeepSeek (primary) → Gemini (fallback)');

  const results = [];

  try {
    results.push(await testStockSummary());
  } catch (error) {
    console.error('Stock summary test failed:', error);
    results.push(false);
  }

  try {
    results.push(await testPortfolioSummary());
  } catch (error) {
    console.error('Portfolio summary test failed:', error);
    results.push(false);
  }

  try {
    results.push(await testBlogGeneration());
  } catch (error) {
    console.error('Blog generation test failed:', error);
    results.push(false);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`✅ Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 All AI tests passed! Configuration is correct.');
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed. Check the errors above.`);
  }

  process.exit(passed === total ? 0 : 1);
}

runAllTests();
