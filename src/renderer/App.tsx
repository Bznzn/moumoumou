import{OverlayPage}from'./overlay/OverlayPage';
import{SettingsPage}from'./settings/SettingsPage';
import{OverviewPage}from'./overview/OverviewPage';
export function App(){const page=new URLSearchParams(location.search).get('page');return page==='overlay'?<OverlayPage/>:page==='overview'?<OverviewPage/>:<SettingsPage/>;}
