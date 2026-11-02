import {beforeAll} from 'vitest';
import {createInstance} from 'i18next';
import {setI18n} from 'react-i18next';
import zh from '../../../../../public/locales/zh-CN/game-fate-domination.json';

// UI 行为测试消费正式语言包，避免空翻译让中文控件断言失去真实入口。
beforeAll(async()=>{
 const instance=createInstance();
 await instance.init({lng:'zh-CN',resources:{'zh-CN':{'game-fate-domination':zh}},defaultNS:'game-fate-domination'});
 setI18n(instance);
});
