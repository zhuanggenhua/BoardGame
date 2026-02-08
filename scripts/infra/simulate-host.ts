
// import fetch from 'node-fetch'; // Use native fetch

const BASE_URL = 'http://localhost:8000/games/TicTacToe';

async function runTest() {
    console.log('🤖 [HostBot] 开始测试流程...');

    try {
        // 1. 创建房间
        console.log('1️⃣  创建房间...');
        const createRes = await fetch(`${BASE_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numPlayers: 2 })
        });
        const { matchID } = await createRes.json() as any;
        console.log(`✅ 房间创建成功: ${matchID}`);
        console.log(`🔗 访客链接: http://localhost:5173/games/tictactoe/match/${matchID}?playerID=1`);

        // 2. 房主加入 (获取凭证以便销毁)
        console.log('2️⃣  房主加入...');
        const joinRes = await fetch(`${BASE_URL}/${matchID}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerID: '0', playerName: 'HostBot' })
        });
        const { playerCredentials } = await joinRes.json() as any;
        console.log('✅ 房主已就位');

        // 3. 等待浏览器加入
        console.log('⏳ 等待 20 秒供浏览器测试...');
        await new Promise(resolve => setTimeout(resolve, 20000));

        // 4. 销毁房间 (离开)
        console.log('💥 正在销毁房间...');
        await fetch(`${BASE_URL}/${matchID}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerID: '0', credentials: playerCredentials })
        });
        console.log('✅ 房间已销毁');

    } catch (error) {
        console.error('❌ 错误:', error);
    }
}

runTest();
