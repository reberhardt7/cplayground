import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './components/App';

ReactDOM.render((
    <App
        inEmbeddedMode={false}
    />
), document.getElementById('app'));

// Hot reloading:
if (module.hot) {
    module.hot.accept();
}
