import{createRoot}from'react-dom/client';
import{App}from'./App';
import'./styles.css';
document.body.dataset.page=new URLSearchParams(location.search).get('page')??'settings';
document.documentElement.dataset.page=document.body.dataset.page;
createRoot(document.getElementById('root')!).render(<App/>);
