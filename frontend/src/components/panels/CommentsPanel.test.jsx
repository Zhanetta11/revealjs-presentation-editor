import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CommentsPanel from "./CommentsPanel";

const comments = [
  {
    id: "c1",
    author: "Altynai Munduzbaeva",
    text: "Please align this title",
    createdAt: "2026-07-01T10:00:00Z",
  },
];

const renderPanel = (props = {}) =>
  render(
    <CommentsPanel
      comments={[]}
      authorName="Altynai"
      onAdd={vi.fn()}
      onDelete={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe("CommentsPanel — rendering", () => {
  test("shows empty state when there are no comments", () => {
    renderPanel();
    expect(
      screen.getByText("No comments on this slide."),
    ).toBeInTheDocument();
  });

  test("renders comment author, text and avatar initials", () => {
    renderPanel({ comments });
    expect(screen.getByText("Altynai Munduzbaeva")).toBeInTheDocument();
    expect(screen.getByText("Please align this title")).toBeInTheDocument();
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  test("close button calls onClose", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("delete button calls onDelete with the comment id", () => {
    const onDelete = vi.fn();
    renderPanel({ comments, onDelete });
    fireEvent.click(screen.getByTitle("Delete comment"));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });
});

describe("CommentsPanel — composing", () => {
  test("'+ New' opens the compose area", () => {
    renderPanel();
    fireEvent.click(screen.getByTitle("New comment"));
    expect(
      screen.getByPlaceholderText("Start a conversation"),
    ).toBeInTheDocument();
  });

  test("autoCompose prop opens the compose area immediately", () => {
    renderPanel({ autoCompose: true });
    expect(
      screen.getByPlaceholderText("Start a conversation"),
    ).toBeInTheDocument();
  });

  test("post button is disabled while the draft is empty or whitespace", () => {
    renderPanel({ autoCompose: true });
    const post = screen.getByTitle("Post comment");
    expect(post).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Start a conversation"), {
      target: { value: "   " },
    });
    expect(post).toBeDisabled();
  });

  test("posting calls onAdd with trimmed text and author, then closes compose", () => {
    const onAdd = vi.fn();
    renderPanel({ autoCompose: true, onAdd });
    fireEvent.change(screen.getByPlaceholderText("Start a conversation"), {
      target: { value: "  Looks good!  " },
    });
    fireEvent.click(screen.getByTitle("Post comment"));
    expect(onAdd).toHaveBeenCalledWith("Looks good!", "Altynai");
    expect(
      screen.queryByPlaceholderText("Start a conversation"),
    ).not.toBeInTheDocument();
  });

  test("Ctrl+Enter posts the draft", () => {
    const onAdd = vi.fn();
    renderPanel({ autoCompose: true, onAdd });
    const textarea = screen.getByPlaceholderText("Start a conversation");
    fireEvent.change(textarea, { target: { value: "Quick note" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onAdd).toHaveBeenCalledWith("Quick note", "Altynai");
  });

  test("Escape cancels composing without posting", () => {
    const onAdd = vi.fn();
    renderPanel({ autoCompose: true, onAdd });
    const textarea = screen.getByPlaceholderText("Start a conversation");
    fireEvent.change(textarea, { target: { value: "Draft" } });
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen.queryByPlaceholderText("Start a conversation"),
    ).not.toBeInTheDocument();
  });

  test("cancel button closes compose and keeps onAdd uncalled", () => {
    const onAdd = vi.fn();
    renderPanel({ autoCompose: true, onAdd });
    fireEvent.click(screen.getByTitle("Cancel"));
    expect(onAdd).not.toHaveBeenCalled();
    expect(
      screen.queryByPlaceholderText("Start a conversation"),
    ).not.toBeInTheDocument();
  });
});
