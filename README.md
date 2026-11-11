<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/arsonite/lockkliye">
    <img src="public/icons/icon-192.png" alt="project icon" width="80" height="80">
  </a>

<h1 align="center">lockkliye</h1>

  <p align="center">
    A powerful and convenient web text editor
    <br />
    <a href="https://github.com/arsonite/lockkliye/issues">Report Bug</a>
    ·
    <a href="https://github.com/arsonite/lockkliye/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#todo">Todo</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ABOUT THE PROJECT -->

## About The Project

lockkliye is a notes app with word-level formatting. Notes are organised in folders and built from text blocks, and each block is made of words that can be styled individually. Block presets and per-note history are stored alongside your notes.

It is installable as a PWA.

### Built With

- [![React][React.js]][React-url]
- [![TypeScript][TypeScript]][TypeScript-url]
- [![Vite][Vite]][Vite-url]
- [![Python][Python]][Python-url]

The data is stored by an HSDB server from the teatype library, the UI uses the teatype workspace packages (`@teatype/components`, `@teatype/hooks`, `@teatype/style`).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

- The [teatype](https://github.com/arsonite/teatype) monorepo checked out next to this repository (`../teatype`), it provides the frontend workspace packages and the Python backend library
- [pnpm](https://pnpm.io/) (e.g. via `corepack enable`)
- Python 3.13

### Installation

1. Install the frontend and backend dependencies

    ```sh
    ./scripts/install
    ```

2. `scripts/install` copies `.env.template` to `.env` and creates the data directory (`LOCKKLIYE_DATA_PATH`, default `/var/lib/lockkliye`, owned by you, mode 750). Edit `.env` to change the client port (`LOCKKLIYE_CLIENT_PORT`, default `8101`) or the HSDB server port (`LOCKKLIYE_PORT`, default `8765`). `LOCKKLIYE_BASE_PATH` (default `/`) is the path the app is served under, homepie publishes it at `/lockkliye/`. `LOCKKLIYE_HOST` (default `127.0.0.1`) set to `0.0.0.0` also serves it directly via the IP of the machine, without any login
3. Start the HSDB server

    ```sh
    ./scripts/launch-server
    ```

4. Start the client

    ```sh
    ./scripts/launch-client
    ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->

## Usage

Run the production build with `pnpm build` and preview it with `pnpm preview`. Notes are stored in `LOCKKLIYE_DATA_PATH` (`/var/lib/lockkliye` by default), back that folder up to keep your notes.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- TODO -->

## Todo

Sorted by priority.

### High

- Implement long press for all right click elements like block settings
- make taskbar thinner and reduce opactity when scrolling only showing full when hovering over taskbar or activating shortcuts and also hide the numbers when holding text size shortcut

### Low

- Right click on global to change the settings there too
- Do not autofocus when creating a new block (setting)
- Add user authentication
- Allow password lockdown of single notes (iCloud style)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the MIT license. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/arsonite/lockkliye](https://github.com/arsonite/lockkliye)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TypeScript]: https://img.shields.io/badge/TypeScript-20232A?style=for-the-badge&logo=typescript&logoColor=3178C6
[TypeScript-url]: https://www.typescriptlang.org/
[Vite]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=FFFFFF
[Vite-url]: https://vitejs.dev/
[Python]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=FFFFFF
[Python-url]: https://www.python.org/
