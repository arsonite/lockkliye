import React, { Component } from 'react';

import ToolBar from './toolBar';

import './style/display.css';

class Display extends Component {
  word = string => {
    let p = document.createElement('p');
    p.className = 'word';
    p.innerHTML = string;
    return p;
  };

  package = text => {
    text = text.replace(/<p.+?>|<\/p>|<\/div>|<span.+?>|<\/span>/g, '');
    text = text.replace(/<div.+?>/g, '§');
    text = text.replace(/<br>/g, '');
    text = text.replace(/&nbsp;/g, '');

    text = text.split(/[\s§]/g);
    let packagedText = document.createElement('div');

    // TODO: Convert to for-int since I have to look up if next symbol is a dot, for sentence structure to avoid space, trim if not
    for (let string of text) {
      if (string === '§') {
        packagedText.innerHTML += '\n';
        continue;
      }

      packagedText.appendChild(this.word(string + ' '));
    }
    return packagedText.innerHTML;
  };

  render() {
    return (
      <div id='display' className='screen'>
        <ToolBar />
        <main
          contentEditable='true'
          onBlur={e => {
            e.target.innerHTML = this.package(e.target.innerHTML);
          }}
        />
      </div>
    );
  }
}

export default Display;
