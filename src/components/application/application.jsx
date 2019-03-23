import React, { Component } from 'react';

import Navigator from './navigator';
import List from './list';
import Display from '../display/display';

import test_entries from '../../test_entries.json';

import './style/application.css';

class Application extends Component {
  state = {
    promiseResolved: false,
    data: null,
    currentCard: null
  };

  componentDidMount() {
    this.setState({ data: test_entries }, () => {
      this.setState({ promiseResolved: true });
    });
  }

  pop() {
    return this.state.data;
  }

  render() {
    if (!this.state.promiseResolved) return null;
    return (
      <div id='app'>
        <Navigator data={this.state.data} />
        <List />
        <Display currentCard={this.state.currentCard} />
      </div>
    );
  }
}

export default Application;
