import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Url from 'url-parse';
import App from './components/App';

ReactDOM.render((
    <App
        inEmbeddedMode={(new Url(window.location.href)).pathname === '/embed'}
    />
), document.getElementById('app'));

// Hot reloading:
if (module.hot) {
    module.hot.accept();
}
