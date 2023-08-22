import htm from "htm";
import vhtml from "vhtml";

import Header from "./components/header.mjs";
import Footer from "./components/footer.mjs";
import Sidebar from "./components/sidebar.mjs";
import Head from "./components/head.mjs";

const html = htm.bind(vhtml);

export default function submit(theme, url = "", title = "") {
  const path = "/submit";
  return html`
    <html lang="en" op="news">
      <head>
        ${Head}
      </head>
      <body>
        <div class="container">
          ${Sidebar(path)}
          <div id="hnmain">
            <table border="0" cellpadding="0" cellspacing="0" bgcolor="#f6f6ef">
              <tr>
                ${Header(theme)}
              </tr>
              <tr>
                <td>
                  <form style="${formContainerStyle}">
                    <div style="${labelInputContainerStyle}">
                      <label for="title" style="${labelStyle}">Title:</label
                      ><br />
                      <div
                        contenteditable="true"
                        role="textbox"
                        aria-multiline="true"
                        id="titleInput"
                        name="title"
                        maxlength="80"
                        required
                        style="${editableContent}"
                        wrap="soft"
                        onpaste="
                          event.preventDefault();
                          const text = event.clipboardData.getData('text/plain');
                          document.execCommand('insertText', false, text);"
                      >
                        ${title}
                      </div>
                      <span>
                        <span>Characters remaining: </span>
                        <span class="remaining">80</span></span
                      >
                    </div>
                    <div style="${labelInputContainerStyle}">
                      <label for="link" style="${labelStyle}">Link:</label
                      ><br />
                      <input
                        id="urlInput"
                        type="text"
                        name="link"
                        size="50"
                        maxlength="2048"
                        required
                        style="${inputStyle}"
                        value="${url}"
                      />
                    </div>
                    <div id="submit-button">
                      <button type="submit" style="${buttonStyle}">
                        Submit
                      </button>
                    </div>
                  </form>
                  <p style="${noteStyle}">
                    <span>Please be mindful of our </span>
                    <a style="color:black;" href="/guidelines">Guidelines</a>.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        </div>
        ${Footer(theme)}
      </body>
    </html>
  `;
}

const formContainerStyle = `
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem 2rem;
`;

const labelInputContainerStyle = `
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const labelStyle = `
  font-size: 16px;
`;

const inputStyle = `
  width: 100%;
  padding: 5px 10px;
  font-size: 16px;
  box-sizing: border-box;
`;

const editableContent = `
   overflow-wrap: anywhere;
   width: 100%;
   height: 100px;
   padding: 5px 10px;
   font-size: 16px;
   box-sizing: border-box;
   border: 1px solid #8f8f9d;
   overflow: auto;
   resize: both;
   white-space: pre-wrap;
   background-color: white;
   color: black;
   border-radius: 3px;
 `;

const buttonStyle = `
  width: 100%;
  padding: 5px;
  font-size: 16px;
  cursor: pointer;
`;

const noteStyle = `
  font-size: 14px;
  text-align: center;
  line-height: 1.5;
  color: #777;
  padding: 0 3px 15px 3px;
`;
