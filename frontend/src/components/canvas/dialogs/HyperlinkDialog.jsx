import { useEffect, useRef, useState } from "react";
import {
  MdDescription,
  MdMailOutline,
  MdWeb,
} from "react-icons/md";
import EmailLinkPanel from "./hyperlink/EmailLinkPanel";
import NewDocumentPanel from "./hyperlink/NewDocumentPanel";
import PlaceLinkPanel from "./hyperlink/PlaceLinkPanel";
import WebLinkPanel from "./hyperlink/WebLinkPanel";
import { normalizeHyperlinkHref } from "../../../core/utils/hyperlinkUtils";
import { isElectron, getElectronAPI } from "../../../core/platform/electron";
import "./dialogs.css";

const LINK_TYPES = [
  { value: "web", label: "Existing File or Web Page", icon: <MdWeb /> },
  { value: "place", label: "Place in This Document", icon: <MdDescription /> },
  { value: "new", label: "Create New Document", icon: <MdDescription /> },
  { value: "email", label: "E-mail Address", icon: <MdMailOutline /> },
];

export default function HyperlinkDialog({
  selectedText = "",
  existingLink = null,
  presentation,
  onApply,
  onClose,
}) {
  const [href, setHref] = useState(existingLink?.href ?? "");
  const [displayText, setDisplayText] = useState(selectedText);
  const [screenTip, setScreenTip] = useState(existingLink?.screenTip ?? "");
  const [linkType, setLinkType] = useState(existingLink?.type ?? "web");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [webFolder, setWebFolder] = useState("Current Folder");
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [showAndReturn, setShowAndReturn] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [editNewDocumentNow, setEditNewDocumentNow] = useState(true);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [activeBrowseButton, setActiveBrowseButton] = useState("");
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef("");
  const slideTitles =
    presentation?.slideset?.slides?.map((slide, index) => {
      const content = slide?.title?.content?.trim();
      return content || `Slide ${index + 1}`;
    }) ?? [];

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const clearError = () => setError("");
  const changeHref = (value) => {
    setHref(value);
    clearError();
  };
  const chooseLocalFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setSelectedFile({
      name: file.name,
      size: file.size,
      type: file.type || "file",
      href: objectUrl,
    });
    setHref(objectUrl);
    if (!displayText.trim()) setDisplayText(file.name);
    if (!screenTip.trim()) setScreenTip(file.name);
    clearError();
  };

  const pickElectronFile = async () => {
    const picked = await getElectronAPI().pickLinkTarget().catch(() => null);
    if (!picked) return;
    setSelectedFile({ name: picked.name, type: "file", href: picked.url });
    setHref(picked.url);
    if (!displayText.trim()) setDisplayText(picked.name);
    if (!screenTip.trim()) setScreenTip(picked.path);
    clearError();
  };

  const browseForFile = () => {
    if (isElectron()) pickElectronFile();
    else fileInputRef.current?.click();
  };

  const submit = (event) => {
    event.preventDefault();
    const value =
      linkType === "place"
        ? `#slide-${selectedSlideIndex + 1}`
        : linkType === "new"
          ? newDocumentName.trim()
          : linkType === "email"
            ? emailAddress.trim()
            : href.trim();
    if (!value) {
      const messages = {
        place: "Select a place in this document.",
        new: "Enter a new document name.",
        email: "Enter an e-mail address.",
        web: "Enter a link address.",
      };
      setError(messages[linkType]);
      return;
    }

    const normalized = normalizeHyperlinkHref(value, linkType);
    const finalHref =
      linkType === "email" && emailSubject.trim()
        ? `${normalized}?subject=${encodeURIComponent(emailSubject.trim())}`
        : normalized;
    const ok = onApply?.({
      href: finalHref,
      text: displayText.trim(),
      screenTip: screenTip.trim(),
      type: linkType,
      showAndReturn,
      editNewDocumentNow,
    });
    if (ok === false) {
      setError("Select text in one paragraph before adding a hyperlink.");
    } else if (objectUrlRef.current === finalHref) {
      objectUrlRef.current = "";
    }
  };

  const askScreenTip = () => {
    const next = window.prompt("ScreenTip text:", screenTip);
    if (next !== null) setScreenTip(next);
  };

  return (
    <div className="text-dialog-backdrop" role="presentation">
      <form
        className="text-context-dialog insert-hyperlink-dialog"
        aria-label="Hyperlink"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose?.();
        }}
      >
        <div className="text-context-dialog-header">
          <strong>Insert Hyperlink</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="insert-hyperlink-display-row">
          <span>Text to display:</span>
          <input
            value={displayText}
            onChange={(event) => setDisplayText(event.target.value)}
          />
          <button type="button" onClick={askScreenTip}>
            ScreenTip...
          </button>
        </div>
        <div className="insert-hyperlink-body">
          <aside className="insert-hyperlink-link-types">
            <span className="insert-hyperlink-link-to">Link to:</span>
            {LINK_TYPES.map((item) => (
              <button
                type="button"
                key={item.value}
                className={linkType === item.value ? "active" : ""}
                onClick={() => {
                  setLinkType(item.value);
                  clearError();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </aside>
          <section className="insert-hyperlink-main">
            {linkType === "web" && (
              <WebLinkPanel
                activeButton={activeBrowseButton}
                fileInputRef={fileInputRef}
                selectedFile={selectedFile}
                webFolder={webFolder}
                onBrowse={setActiveBrowseButton}
                onChooseFile={browseForFile}
                onFileChange={chooseLocalFile}
                onFolderChange={(folder) => {
                  setWebFolder(folder);
                  clearError();
                }}
                onHrefChange={changeHref}
              />
            )}
            {linkType === "place" && (
              <PlaceLinkPanel
                slideTitles={slideTitles}
                selectedSlideIndex={selectedSlideIndex}
                showAndReturn={showAndReturn}
                onSlideSelect={(index) => {
                  setSelectedSlideIndex(index);
                  changeHref(`#slide-${index + 1}`);
                }}
                onShowAndReturnChange={setShowAndReturn}
              />
            )}
            {linkType === "new" && (
              <NewDocumentPanel
                documentName={newDocumentName}
                editNow={editNewDocumentNow}
                onDocumentNameChange={(value) => {
                  setNewDocumentName(value);
                  changeHref(value);
                }}
                onEditNowChange={setEditNewDocumentNow}
              />
            )}
            {linkType === "email" && (
              <EmailLinkPanel
                emailAddress={emailAddress}
                emailSubject={emailSubject}
                onAddressChange={(value) => {
                  setEmailAddress(value);
                  changeHref(value);
                }}
                onSubjectChange={setEmailSubject}
              />
            )}
          </section>
        </div>
        {linkType === "web" && (
          <label className="hyperlink-dialog-field insert-hyperlink-address-row">
            <span>Address:</span>
            <input
              autoFocus
              value={href}
              onChange={(event) => changeHref(event.target.value)}
              placeholder="https://example.com"
            />
          </label>
        )}
        {screenTip && (
          <div className="insert-hyperlink-screentip">
            ScreenTip: {screenTip}
          </div>
        )}
        {error && <div className="text-context-dialog-error">{error}</div>}
        <div className="text-context-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            OK
          </button>
        </div>
      </form>
    </div>
  );
}
