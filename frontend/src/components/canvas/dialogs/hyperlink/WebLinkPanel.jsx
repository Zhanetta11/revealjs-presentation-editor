import {
  MdDescription,
  MdFolder,
  MdInsertDriveFile,
  MdSearch,
} from "react-icons/md";

const WEB_FOLDERS = ["Current Folder", "Browsed Pages", "Recent Files"];

function BrowseButton({ title, icon, active, onClick }) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function BrowseButtons({ activeButton, onBrowse, onChooseFile }) {
  return (
    <>
      <BrowseButton
        title="Browse the Web"
        icon={<MdSearch />}
        active={activeButton === "web"}
        onClick={() => onBrowse("web")}
      />
      <BrowseButton
        title="Browse for File"
        icon={<MdDescription />}
        active={activeButton === "file"}
        onClick={() => {
          onBrowse("file");
          onChooseFile();
        }}
      />
      <BrowseButton
        title="Browse for Folder"
        icon={<MdFolder />}
        active={activeButton === "folder"}
        onClick={() => {
          onBrowse("folder");
          onChooseFile();
        }}
      />
    </>
  );
}

export default function WebLinkPanel({
  activeButton,
  fileInputRef,
  selectedFile,
  webFolder,
  onBrowse,
  onChooseFile,
  onFileChange,
  onFolderChange,
  onHrefChange,
}) {
  const isCurrentFolder = webFolder === "Current Folder";
  const items = [];

  return (
    <>
      {isCurrentFolder ? (
        <div className="insert-hyperlink-lookin-row">
          <span>Look in:</span>
          <select defaultValue="Downloads">
            <option>Downloads</option>
            <option>Documents</option>
            <option>Desktop</option>
          </select>
          <BrowseButtons
            activeButton={activeButton}
            onBrowse={onBrowse}
            onChooseFile={onChooseFile}
          />
        </div>
      ) : (
        <div className="insert-hyperlink-history-toolbar">
          <BrowseButtons
            activeButton={activeButton}
            onBrowse={onBrowse}
            onChooseFile={onChooseFile}
          />
        </div>
      )}

      <div
        className={[
          "insert-hyperlink-browser",
          !isCurrentFolder ? "insert-hyperlink-browser--history" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <nav>
          {WEB_FOLDERS.map((folder) => (
            <button
              type="button"
              key={folder}
              className={webFolder === folder ? "active" : ""}
              onClick={() => onFolderChange(folder)}
            >
              {folder}
            </button>
          ))}
        </nav>
        <div
          className={[
            "insert-hyperlink-file-list",
            !isCurrentFolder ? "insert-hyperlink-file-list--history" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isCurrentFolder && selectedFile && (
            <button
              type="button"
              className="selected"
              onClick={() => onHrefChange(selectedFile.href)}
            >
              <MdInsertDriveFile />
              <span>{selectedFile.name}</span>
            </button>
          )}
          {items.map((file) => (
            <button
              type="button"
              key={file}
              onClick={() => onHrefChange(file)}
            >
              {isCurrentFolder ? <MdFolder /> : null}
              <span>{file}</span>
            </button>
          ))}
          {items.length === 0 && !selectedFile && (
            <div className="insert-hyperlink-empty-list">
              Use Browse... to link to a file, or type an address below.
            </div>
          )}
        </div>
        <div className="insert-hyperlink-side-buttons">
          <button
            type="button"
            title="Choose file from PC"
            aria-label="Choose file from PC"
            onClick={onChooseFile}
          >
            Browse...
          </button>
          <button type="button">Bookmark...</button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="insert-hyperlink-file-input"
        onChange={onFileChange}
      />
    </>
  );
}
