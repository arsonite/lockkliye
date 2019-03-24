import React, { Component } from 'react';

import ToolBar from './toolBar';

import './style/display.css';
import { connectableObservableDescriptor } from 'rxjs/internal/observable/ConnectableObservable';

const FLAG_STOPPER = 'Φ';
const FLAG_NL = 'Ψ';
const FLAG_S = 'Ω';

class Display extends Component {
  state = {
    selector: undefined
  };

  word = string => {
    let p = document.createElement('p');
    p.className = 'word';
    p.innerHTML = string;
    p.onclick = e => {
      console.log(e.target.style);
    };

    return p;
  };

  package = text => {
    text = text.replace(/<p.+?>|<\/p>|<\/div>|<span.+?>|<\/span>|<br>/g, '');
    text = text.replace(/<div>/g, FLAG_STOPPER + FLAG_NL);
    text = text.replace(/&nbsp;|\s/g, FLAG_S + ' ');

    text = text.split(/[\sΦΩ]/g);
    let packagedText = document.createElement('div');
    packagedText.id = 'content';

    // TODO: Convert to for-int since I have to look up if next symbol is a dot, for sentence structure to avoid space, trim if not
    for (let string of text) {
      if (string === FLAG_NL) {
        packagedText.appendChild(document.createElement('br'));
        continue;
      } else if (string === '') {
        packagedText.innerHTML += ' ';
        continue;
      }
      packagedText.appendChild(this.word(string));
    }
    this.setState({ selector: 1 });
    return packagedText;
  };

  render() {
    return (
      <div id='display' className='screen'>
        <ToolBar />
        <main
          contentEditable={this.state.selector === undefined ? true : false}
          onBlur={e => {
            let main = this.package(e.target.innerHTML);
            e.target.innerHTML = '';
            e.target.appendChild(main);
          }}
        />
        <div id='content' />
      </div>
    );
  }
}

export default Display;
